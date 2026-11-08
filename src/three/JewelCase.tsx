import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { MutableRefObject } from "react";
import type { ArchiveControls, CatalogEntry } from "../types";
import { CASE_W, CASE_H, CASE_D } from "../lib/arc";
import { drawBackInsert, scratchRoughness } from "../lib/textures";
import Disc from "./Disc";

const TRAY_Z = -0.032;
const LID_Z = 0.046;
const OPEN_ANGLE = Math.PI * 0.69; // ~124°

const trayGeo = new THREE.BoxGeometry(CASE_W, CASE_H, 0.036);
const lidGeo = new THREE.BoxGeometry(CASE_W, CASE_H, 0.014);
const coverGeo = new THREE.PlaneGeometry(CASE_W - 0.014, CASE_H - 0.014);
const spineGeo = new THREE.PlaneGeometry(CASE_D, CASE_H);
const hingeGeo = new THREE.BoxGeometry(0.045, 0.1, 0.05);

let scratch: THREE.Texture | null = null;
const getScratch = () => (scratch ??= scratchRoughness(512));

export default function JewelCase({
  entry,
  active,
  ctrl,
  groupRef,
  onSelect,
  onHover,
}: {
  entry: CatalogEntry;
  active: boolean;
  ctrl: MutableRefObject<ArchiveControls>;
  groupRef: (el: THREE.Group | null) => void;
  onSelect: () => void;
  onHover: (v: string | null) => void;
}) {
  const { album, texture, palette, spine } = entry;
  const innerRef = useRef<THREE.Group>(null);
  const lidRef = useRef<THREE.Group>(null);

  const coverMaterial = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      map: texture,
      roughness: 0.42,
      metalness: 0.03,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.1,
    });
    return m;
  }, [texture]);

  const spineMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: spine,
        roughness: 0.5,
        metalness: 0.02,
        clearcoat: 0.6,
        clearcoatRoughness: 0.2,
        envMapIntensity: 1,
      }),
    [spine],
  );

  const backTexture = useMemo(() => {
    if (!active) return null;
    const tex = new THREE.CanvasTexture(drawBackInsert(album, palette));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, [active, album, palette]);

  useFrame(() => {
    const o = active ? ctrl.current.open : 0;
    if (lidRef.current) lidRef.current.rotation.y = -o * OPEN_ANGLE;
    if (innerRef.current) innerRef.current.position.x = o * (CASE_W / 2);
  });

  return (
    <group
      ref={groupRef}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(album.id);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onHover(null);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <group ref={innerRef}>
        {/* tray */}
        <mesh geometry={trayGeo} position={[0, 0, TRAY_Z]} castShadow receiveShadow>
          <meshPhysicalMaterial
            color="#23252a"
            roughness={0.34}
            metalness={0.15}
            clearcoat={0.9}
            clearcoatRoughness={0.24}
          />
        </mesh>

        {/* booklet edge along the top — what you see on a packed shelf */}
        <mesh position={[0, CASE_H / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[CASE_W - 0.03, CASE_D - 0.014]} />
          <meshStandardMaterial color="#e7e1d5" roughness={0.92} />
        </mesh>

        {/* spine insert */}
        <mesh
          geometry={spineGeo}
          position={[CASE_W / 2 + 0.001, 0, 0]}
          rotation={[0, Math.PI / 2, 0]}
          material={spineMaterial}
        />

        {active && (
          <>
            {/* disc seat recessed into the tray */}
            <mesh position={[0, 0, 0.002]}>
              <ringGeometry args={[0.6, 0.645, 72]} />
              <meshStandardMaterial color="#34383f" roughness={0.5} metalness={0.1} />
            </mesh>
            <Disc album={album} palette={palette} ctrl={ctrl} />
            <mesh position={[0, 0, -0.049]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[CASE_W - 0.03, CASE_H - 0.03]} />
              <meshStandardMaterial map={backTexture} roughness={0.88} />
            </mesh>
          </>
        )}

        {/* --- lid half, hinged on the left edge --- */}
        {active ? (
          <group ref={lidRef} position={[-CASE_W / 2, 0, 0]}>
            <mesh geometry={lidGeo} position={[CASE_W / 2, 0, LID_Z]} castShadow>
              <meshPhysicalMaterial
                color="#ffffff"
                transmission={0.94}
                thickness={0.06}
                roughness={0.09}
                metalness={0}
                ior={1.49}
                clearcoat={1}
                clearcoatRoughness={0.03}
                roughnessMap={getScratch()}
                envMapIntensity={1.8}
                transparent
              />
            </mesh>
            <mesh geometry={coverGeo} position={[CASE_W / 2, 0, LID_Z - 0.014]} material={coverMaterial} />
            <mesh
              geometry={coverGeo}
              position={[CASE_W / 2, 0, LID_Z - 0.026]}
              rotation={[0, Math.PI, 0]}
              material={coverMaterial}
            />
            {[-0.46, 0.46].map((y) => (
              <mesh key={y} geometry={hingeGeo} position={[0.012, y, LID_Z - 0.01]}>
                <meshPhysicalMaterial color="#8f959c" roughness={0.3} metalness={0.1} clearcoat={1} />
              </mesh>
            ))}
          </group>
        ) : (
          <mesh geometry={coverGeo} position={[0, 0, LID_Z - 0.014]} material={coverMaterial} />
        )}
      </group>
    </group>
  );
}
