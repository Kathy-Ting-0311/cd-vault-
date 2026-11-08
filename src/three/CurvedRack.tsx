import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { MutableRefObject } from "react";
import type { ArchiveControls, CatalogEntry } from "../types";
import { poseAt, wrapSigned, CASE_W, CASE_H } from "../lib/arc";
import { softShadowTexture } from "../lib/textures";
import JewelCase from "./JewelCase";

export default function CurvedRack({
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
  onSelect: (albumIndex: number) => void;
  onHover: (id: string | null) => void;
  onIndexChange: (i: number) => void;
  locked: boolean;
  rectRef: MutableRefObject<{ x: number; y: number; w: number; h: number }>;
}) {
  const { camera, size } = useThree();
  const lastK = useRef(-1);
  const proj = useRef(new THREE.Vector3());
  const n = entries.length;
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const shadowRefs = useRef<(THREE.Mesh | null)[]>([]);
  const hoverCur = useRef(new Float32Array(32));

  const shadowTex = useMemo(() => softShadowTexture(256), []);
  const shadowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.5,
      }),
    [shadowTex],
  );

  // every album gets exactly one stable slot; only its offset wraps
  const slots = useMemo(() => entries.map((_, i) => i), [entries.length]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const c = ctrl.current;

    c.index += (c.target - c.index) * (1 - Math.exp(-5.2 * dt));
    const index = c.index;
    const k = ((Math.round(index) % n) + n) % n;
    if (k !== lastK.current) {
      lastK.current = k;
      onIndexChange(k);
    }

    for (let i = 0; i < slots.length; i++) {
      const g = groupRefs.current[i];
      if (!g) continue;
      const u = wrapSigned(slots[i] - index, n);
      const p = poseAt(u);
      const active = slots[i] === activeIndex;

      const target = !locked && Math.abs(u) > 0.5 ? 0 : g.userData.hover ? 0.07 : 0;
      hoverCur.current[i] += (target - hoverCur.current[i]) * (1 - Math.exp(-9 * dt));

      g.position.set(p.x, p.y, p.z + hoverCur.current[i]);
      if (active) {
        g.position.z += c.extract * 0.92;
        g.position.y += c.extract * 0.04;
      }
      g.rotation.set(0, p.rotY * (1 - (active ? c.extract : 0)), p.rotZ);
      g.scale.setScalar(p.scale);

      if (active) {
        const hw = (CASE_W / 2) * p.scale;
        const hh = (CASE_H / 2) * p.scale;
        const cz = g.position.z + 0.032;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const sx of [-1, 1]) {
          for (const sy of [-1, 1]) {
            const v = proj.current.set(g.position.x + sx * hw, g.position.y + sy * hh, cz).project(camera);
            const px = (v.x * 0.5 + 0.5) * size.width;
            const py = (0.5 - v.y * 0.5) * size.height;
            minX = Math.min(minX, px);
            maxX = Math.max(maxX, px);
            minY = Math.min(minY, py);
            maxY = Math.max(maxY, py);
          }
        }
        rectRef.current = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      }

      const sh = shadowRefs.current[i];
      if (sh) {
        const fade = Math.max(0, 1 - p.falloff * 1.35);
        sh.position.set(p.x - 0.06, p.y - 0.1, p.z - 0.22 + hoverCur.current[i]);
        sh.scale.setScalar(p.scale * 1.9);
        (sh.material as THREE.MeshBasicMaterial).opacity =
          0.45 * fade * (active ? 1 - c.extract * 0.6 : 1);
      }
    }
  });

  return (
    <group>
      {slots.map((slot) => {
        const entry = entries[slot];
        return (
          <group key={entry.album.id}>
            <mesh
              ref={(el) => {
                shadowRefs.current[slot] = el;
              }}
              material={shadowMat}
              renderOrder={-1}
            >
              <planeGeometry args={[1, 1]} />
            </mesh>
            <JewelCase
              entry={entry}
              active={slot === activeIndex}
              ctrl={ctrl}
              groupRef={(el) => {
                groupRefs.current[slot] = el;
              }}
              onSelect={() => onSelect(slot)}
              onHover={(id) => {
                onHover(id);
                const g = groupRefs.current[slot];
                if (g) g.userData.hover = id === entry.album.id;
              }}
            />
          </group>
        );
      })}
    </group>
  );
}
