import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { MutableRefObject } from "react";
import type { Album, ArchiveControls, Palette } from "../types";
import { drawDiscLabel } from "../lib/textures";

/* ------------------------------------------------------------------ *
 *  a 120 mm compact disc: r 60 mm, 1.2 mm thick, 15 mm centre hole
 * ------------------------------------------------------------------ */

const R = 0.6;
const HOLE = 0.075;
const THICK = 0.012;
const SEGMENTS = 128;

/**
 * RingGeometry normalises its UVs per ring, which collapses a texture onto
 * every radius. Build the annulus by hand so the label maps like a real disc.
 */
function makeFace(inner: number, outer: number, seg: number) {
  const g = new THREE.BufferGeometry();
  const count = (seg + 1) * 2;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);

  let p = 0;
  let u = 0;
  for (let ring = 0; ring < 2; ring++) {
    const r = ring === 0 ? inner : outer;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      pos[p] = x;
      pos[p + 1] = y;
      pos[p + 2] = 0;
      nor[p] = 0;
      nor[p + 1] = 0;
      nor[p + 2] = 1;
      p += 3;
      uv[u] = x / (2 * outer) + 0.5;
      uv[u + 1] = y / (2 * outer) + 0.5;
      u += 2;
    }
  }

  const idx: number[] = [];
  for (let i = 0; i < seg; i++) {
    const a = i;
    const b = i + 1;
    const c = seg + 1 + i;
    const d = seg + 2 + i;
    idx.push(a, d, b, a, c, d);
  }

  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

const faceGeo = makeFace(HOLE, R, SEGMENTS);
const rimGeo = new THREE.CylinderGeometry(R, R, THICK, SEGMENTS, 1, true);
const hubGeo = new THREE.CylinderGeometry(HOLE, HOLE, THICK * 1.9, 48, 1, false);

rimGeo.rotateX(Math.PI / 2);
hubGeo.rotateX(Math.PI / 2);

/* ------------------------------------------------------------------ *
 *  diffraction shader, injected into a MeshPhysicalMaterial
 * ------------------------------------------------------------------ */

const FRAG_HEAD = /* glsl */ `
  varying vec2 vCdPos;
  uniform float uTime;
  uniform vec2 uLight;
  uniform float uStrength;

  vec3 cdSpectrum(float t) {
    return 0.5 + 0.5 * cos(6.28318530718 * (vec3(0.0, 0.33, 0.67) + t));
  }
`;

const FRAG_BODY = /* glsl */ `
  {
    // object-space disc coordinate, -1..1
    vec2 dp = vCdPos / ${R.toFixed(4)};
    float rr = clamp(length(dp), 0.0, 1.0);

    // view-space normal: the camera looks down -Z, so N.z is N·V
    float ndv = clamp(normal.z, 0.0, 1.0);
    float fres = pow(1.0 - ndv, 2.0);

    // diffraction rings centred on the key light's mirror point
    float d = length(dp - uLight);
    float hue = fract(d * 0.4 + rr * 0.95 + fres * 0.2 + uTime * 0.005);
    vec3 spectral = mix(vec3(1.0), cdSpectrum(hue), 0.85);

    // microscopic tracks: fade out once they fall below a pixel
    float g = rr * 235.0;
    float aa = 1.0 - smoothstep(0.45, 1.5, fwidth(g));
    float grooves = 0.5 + 0.5 * sin(g);

    // never a flat overlay — it lives along the outer edge and grows with tilt
    float edge = smoothstep(0.06, 1.0, rr);
    float tilt = 0.55 + 0.45 * smoothstep(0.0, 0.3, fres);
    // tint the existing reflection — that is how diffraction actually reads
    vec3 tint = mix(vec3(1.0), spectral, 0.72 * (0.12 + 0.88 * edge) * tilt);
    gl_FragColor.rgb *= tint;

    float amt = (0.02 + 0.1 * edge) * (0.72 + 0.28 * grooves) * tilt * aa * uStrength;
    gl_FragColor.rgb += spectral * amt;
  }
`;

function withDiffraction(mat: THREE.MeshPhysicalMaterial, strength: number) {
  const uniforms = {
    uTime: { value: 0 },
    uLight: { value: new THREE.Vector2(0.32, 0.34) },
    uStrength: { value: strength },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vCdPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvCdPos = position.xy;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAG_HEAD}`)
      // subtly dish the surface so a flat mirror sweeps the studio reflections
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        {
          vec2 dq = vCdPos / ${R.toFixed(4)};
          float rq = clamp(length(dq), 0.0, 1.0);
          vec2 rdir = dq / max(rq, 1e-4);
          float dish = 0.14 * smoothstep(0.06, 1.0, rq);
          normal = normalize(normal + vec3(rdir * dish, 0.0));
        }`,
      )
      .replace("#include <opaque_fragment>", `#include <opaque_fragment>\n${FRAG_BODY}`);
  };
  mat.customProgramCacheKey = () => "cd-diffraction";
  (mat as THREE.MeshPhysicalMaterial & { __u?: typeof uniforms }).__u = uniforms;
  return mat as THREE.MeshPhysicalMaterial & { __u: typeof uniforms };
}

/* ------------------------------------------------------------------ */

export default function Disc({
  album,
  palette,
  ctrl,
}: {
  album: Album;
  palette: Palette;
  ctrl: MutableRefObject<ArchiveControls>;
}) {
  const ref = useRef<THREE.Group>(null);
  const reduced = useRef(
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const label = useMemo(() => {
    const tex = new THREE.CanvasTexture(drawDiscLabel(album, palette));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, [album, palette]);

  // printed side: ink over a metallic substrate
  const faceMat = useMemo(
    () =>
      withDiffraction(
        new THREE.MeshPhysicalMaterial({
          map: label,
          metalness: 0.86,
          roughness: 0.06,
          clearcoat: 0.6,
          clearcoatRoughness: 0.08,
          envMapIntensity: 1.7,
          iridescence: 0.1,
          iridescenceIOR: 1.3,
        }),
        1,
      ),
    [label],
  );

  // data side: bare aluminium
  const backMat = useMemo(
    () =>
      withDiffraction(
        new THREE.MeshPhysicalMaterial({
          color: "#d9dde3",
          metalness: 1,
          roughness: 0.12,
          clearcoat: 0.4,
          envMapIntensity: 1.8,
        }),
        0.85,
      ),
    [],
  );

  const rimMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#e4e8ee",
        metalness: 1,
        roughness: 0.16,
        envMapIntensity: 1.7,
      }),
    [],
  );

  const hubMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#f2f5f8",
        metalness: 0.2,
        roughness: 0.05,
        transparent: true,
        opacity: 0.42,
        envMapIntensity: 2.2,
      }),
    [],
  );

  const mats = useMemo(() => [faceMat, backMat], [faceMat, backMat]);

  useFrame((state, delta) => {
    const g = ref.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    const c = ctrl.current;

    const t = state.clock.elapsedTime;
    for (const m of mats) m.__u.uTime.value = t;

    // the tilt only makes sense once the lid is out of the way
    const openF = THREE.MathUtils.smoothstep(c.open, 0.5, 0.95);
    const px = reduced.current ? 0 : state.pointer.x;
    const py = reduced.current ? 0 : state.pointer.y;

    const targetX = -py * THREE.MathUtils.degToRad(4.5) * openF;
    const targetY = px * THREE.MathUtils.degToRad(7) * openF;
    const k = 1 - Math.exp(-6 * dt);

    g.rotation.x += (targetX - g.rotation.x) * k;
    g.rotation.y += (targetY - g.rotation.y) * k;
    g.rotation.z = (reduced.current ? 0 : Math.sin(t * 0.22) * 0.12) * openF;

    // slide the diffraction rings with the pointer so the sheen travels
    const lx = 0.32 + px * 0.22 * openF;
    const ly = 0.34 + py * 0.22 * openF;
    for (const m of mats) m.__u.uLight.value.set(lx, ly);

    // lift clear of the tray so the tilt never sinks into it
    g.position.z = 0.012 + openF * 0.06;
  });

  return (
    <group ref={ref} position={[0, 0, 0.012]}>
      <mesh geometry={faceGeo} material={faceMat} />
      <mesh geometry={faceGeo} material={backMat} position={[0, 0, -THICK]} rotation={[0, Math.PI, 0]} />
      <mesh geometry={rimGeo} material={rimMat} position={[0, 0, -THICK / 2]} />
      <mesh geometry={hubGeo} material={hubMat} position={[0, 0, -THICK / 2]} />
    </group>
  );
}
