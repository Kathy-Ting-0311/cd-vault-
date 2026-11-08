import { useMemo } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { studioDome } from "../lib/textures";
import type { MutableRefObject } from "react";
import type { ArchiveControls, CatalogEntry } from "../types";
import { CASE_W } from "../lib/arc";
import CurvedRack from "./CurvedRack";

const FOV = 34;

function Rig({ ctrl }: { ctrl: MutableRefObject<ArchiveControls> }) {
  const { camera, size } = useThree();

  const poses = useMemo(() => {
    const aspect = size.width / size.height;
    const tan = Math.tan((FOV / 2) * (Math.PI / 180));
    const mobile = size.width < 760;
    const fracW = mobile ? 0.56 : size.width < 1180 ? 0.4 : 0.3;
    const visibleW = CASE_W / fracW;
    const visibleH = visibleW / aspect;
    const d = visibleW / (2 * tan * aspect);
    const screenY = mobile ? 0.4 : 0.455;
    const ty = (screenY - 0.5) * visibleH;

    // the opened case is ~1.56 case-widths across, measured from its tray plane
    const openW = CASE_W * 1.56;
    const closeFrac = mobile ? 0.84 : 0.58;
    const closeVisibleW = openW / closeFrac;
    const closeVisibleH = closeVisibleW / aspect;
    const closeD = closeVisibleW / (2 * tan * aspect);
    const caseY = 0.05;
    const closeScreenY = mobile ? 0.33 : 0.44;
    const tyClose = caseY - (0.5 - closeScreenY) * closeVisibleH;

    return {
      browsePos: new THREE.Vector3(0, ty + 0.22, d),
      browseTarget: new THREE.Vector3(0, ty, 0),
      closePos: new THREE.Vector3(0.28, tyClose + 0.14, 0.94 + closeD),
      closeTarget: new THREE.Vector3(0.28, tyClose, 0.62),
    };
  }, [size]);

  const look = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const w = ctrl.current.cam;
    const ease = 1 - Math.exp(-4.2 * dt);
    const px = poses.browsePos.x + (poses.closePos.x - poses.browsePos.x) * w;
    const py = poses.browsePos.y + (poses.closePos.y - poses.browsePos.y) * w;
    const pz = poses.browsePos.z + (poses.closePos.z - poses.browsePos.z) * w;
    camera.position.lerp(new THREE.Vector3(px, py, pz), ease);

    look.lerp(
      new THREE.Vector3(
        poses.browseTarget.x + (poses.closeTarget.x - poses.browseTarget.x) * w,
        poses.browseTarget.y + (poses.closeTarget.y - poses.browseTarget.y) * w,
        poses.browseTarget.z + (poses.closeTarget.z - poses.browseTarget.z) * w,
      ),
      ease,
    );
    camera.lookAt(look);
  });

  return null;
}

const dome = studioDome(512);

export default function ArchiveScene({
  entries,
  ctrl,
  activeIndex,
  onSelect,
  onHover,
  onIndexChange,
  locked,
  rectRef,
}: {
  entries: CatalogEntry[];
  ctrl: MutableRefObject<ArchiveControls>;
  activeIndex: number;
  onSelect: (i: number) => void;
  onHover: (id: string | null) => void;
  onIndexChange: (i: number) => void;
  locked: boolean;
  rectRef: MutableRefObject<{ x: number; y: number; w: number; h: number }>;
}) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: FOV, near: 0.1, far: 60, position: [0, 0, 6] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1.0;
        gl.setClearAlpha(0);
      }}
    >
      <ambientLight intensity={1.15} color="#fff7ea" />
      <directionalLight position={[2.6, 3.4, 4.2]} intensity={2.4} color="#fff4e2" />
      <directionalLight position={[-3.4, 1.2, 2.2]} intensity={0.75} color="#dbe4ff" />
      <directionalLight position={[0.4, -2.2, 2.6]} intensity={0.5} color="#ffffff" />

      <Environment resolution={512} frames={1}>
        {/* a continuous warm dome, so a mirror disc reflects a studio rather than void */}
        <mesh scale={90}>
          <sphereGeometry args={[1, 32, 16]} />
          <meshBasicMaterial map={dome} side={THREE.BackSide} />
        </mesh>
        {/* a soft warm panel in front */}
        <Lightformer
          form="rect"
          intensity={0.8}
          position={[0, 0.6, 5.4]}
          scale={[18, 13, 1]}
          color="#f7f2e9"
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={0.55}
          position={[0, -2.6, 3.4]}
          scale={[14, 5, 1]}
          color="#e8e2d6"
          target={[0, 0, 0]}
        />
        {/* broad key softbox */}
        <Lightformer
          form="rect"
          intensity={2.6}
          position={[-3, 2.6, 3.2]}
          scale={[7, 5, 1]}
          color="#fffaf0"
          target={[0, 0, 0]}
        />
        {/* narrow strips — the long specular streaks you get on a disc */}
        <Lightformer
          form="rect"
          intensity={9}
          position={[-0.95, 1.15, 3.1]}
          scale={[0.22, 5.4, 1]}
          color="#ffffff"
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={6}
          position={[1.15, 0.3, 3.0]}
          scale={[0.16, 4.6, 1]}
          color="#f4f7ff"
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={1.2}
          position={[3.4, 0.8, 2.4]}
          scale={[5, 4, 1]}
          color="#e6ecff"
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={1.4}
          position={[0, 3.4, -1.5]}
          scale={[9, 4, 1]}
          color="#ffffff"
          target={[0, 0, 0]}
        />
      </Environment>

      <CurvedRack
        entries={entries}
        ctrl={ctrl}
        activeIndex={activeIndex}
        onSelect={onSelect}
        onHover={onHover}
        onIndexChange={onIndexChange}
        locked={locked}
        rectRef={rectRef}
      />
      <Rig ctrl={ctrl} />
    </Canvas>
  );
}
