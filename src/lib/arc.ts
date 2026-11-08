/* ------------------------------------------------------------------ *
 *  curved-rack geometry
 *
 *  Each slot sits at a signed offset u from the centred disc. Scale falls
 *  away with |u| while the horizontal offset is the integral of that scale,
 *  so the rack compresses toward both edges — the same construction the
 *  reference uses, retuned to jewel-case proportions.
 * ------------------------------------------------------------------ */

export const CASE_W = 1.42;
export const CASE_H = 1.25;
export const CASE_D = 0.104;

const U = 7;
const SPACING = 0.46;
const LUT_MAX = 13;
const LUT: number[] = [0];

export function scaleAt(u: number) {
  return 1 / (1 + Math.pow(Math.abs(u) / U, 1.6));
}

// integrate the scale curve once, at load, into a lookup table
for (let i = 1; i <= LUT_MAX; i++) {
  LUT[i] = LUT[i - 1] + SPACING * (scaleAt(i - 0.5) + scaleAt(i + 0.5)) * 0.5;
}

export function offsetAt(u: number) {
  const a = Math.abs(u);
  const i = Math.min(Math.floor(a), LUT_MAX - 1);
  const f = Math.min(1, a - i);
  const lo = LUT[i];
  const hi = LUT[i + 1] ?? lo;
  return Math.sign(u) * (lo + (hi - lo) * f);
}

export interface Pose {
  x: number;
  y: number;
  z: number;
  rotY: number;
  rotZ: number;
  scale: number;
  /** 0 at the centre → 1 at the far edge, for fading */
  falloff: number;
}

export function poseAt(u: number): Pose {
  const a = Math.abs(u);
  const s = scaleAt(u);
  return {
    x: offsetAt(u),
    y: -0.013 * Math.pow(a, 1.45),
    z: -0.1 * Math.pow(a, 1.15),
    rotY: -Math.sign(u) * Math.min(0.5, a * 0.052),
    rotZ: Math.sign(u) * Math.min(0.05, a * 0.006),
    scale: s,
    falloff: Math.min(1, a / 9),
  };
}

/** shortest signed distance between two positions on a ring of n */
export function wrapSigned(d: number, n: number) {
  return ((((d + n / 2) % n) + n) % n) - n / 2;
}

export const COLS = { desktop: 10, tablet: 7, mobile: 4 };
