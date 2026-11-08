import * as THREE from "three";
import type { Album, CatalogEntry, Palette } from "../types";

/* ------------------------------------------------------------------ *
 *  colour
 * ------------------------------------------------------------------ */

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const css = (rgb: [number, number, number], a = 1) =>
  `rgba(${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(
    rgb[2] * 255,
  )},${a})`;

export function extractPalette(image: HTMLImageElement): Palette {
  const S = 32;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0, S, S);
  const { data } = ctx.getImageData(0, 0, S, S);

  const bins = Array.from({ length: 12 }, () => ({ w: 0, best: [0.45, 0.42, 0.4] as [number, number, number], top: -1 }));
  let luminance = 0;
  let n = 0;
  let chromatic = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const [h, s, l] = rgbToHsl(r, g, b);
    luminance += l;
    chromatic += s;
    n++;

    const bin = bins[Math.min(11, Math.floor(h * 12))];
    bin.w += (0.08 + s) * (0.35 + Math.min(1, l * 1.6));
    const score = s * s * (0.35 + l);
    if (score > bin.top) {
      bin.top = score;
      bin.best = [r, g, b];
    }
  }

  const top = bins.reduce((a, b) => (b.w > a.w ? b : a));
  const meanSat = chromatic / n;
  const dom = top.best;
  let [dh, ds, dl] = rgbToHsl(dom[0], dom[1], dom[2]);
  if (meanSat < 0.11) ds *= 0.35;

  const spineH = dh;
  const spineS = clamp(ds * 0.86 + 0.03, 0.05, 0.54);
  const spineL = clamp(dl * 0.66 + 0.02, 0.06, 0.34);
  const spineRgb = hslToRgb(spineH, spineS, spineL);

  const accentRgb = hslToRgb(spineH, clamp(ds + 0.2, 0.3, 0.85), clamp(dl + 0.32, 0.5, 0.74));
  const darkRgb = hslToRgb(spineH, spineS * 0.9, clamp(spineL * 0.42, 0.05, 0.13));
  const avgLum = luminance / n;

  return {
    spine: css(spineRgb),
    spineRgb,
    accent: css(accentRgb),
    accentRgb,
    dark: css(darkRgb),
    darkRgb,
    ink: avgLum > 0.62 ? "#141210" : "#f4ede2",
    avgLum,
  };
}

/* ------------------------------------------------------------------ *
 *  canvas helpers
 * ------------------------------------------------------------------ */

export function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function canvasTexture(canvas: HTMLCanvasElement, srgb = true) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}

function fallbackCover(album: Album, h = 0.6): HTMLCanvasElement {
  const c = makeCanvas(600, 600);
  const ctx = c.getContext("2d")!;
  const a = hslToRgb(h, 0.32, 0.3);
  const b = hslToRgb((h + 0.22) % 1, 0.24, 0.16);
  const g = ctx.createLinearGradient(0, 0, 600, 600);
  g.addColorStop(0, css(a));
  g.addColorStop(1, css(b));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 600, 600);
  ctx.strokeStyle = "rgba(255,255,255,.07)";
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.arc(300, 300, 50 + i * 22, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "#f2e9dc";
  ctx.textAlign = "center";
  ctx.font = "600 30px 'Noto Sans TC', sans-serif";
  ctx.fillText(album.artistName, 300, 280);
  ctx.font = "700 40px 'Newsreader', serif";
  ctx.fillText(album.title.slice(0, 16), 300, 336);
  return c;
}

/* ------------------------------------------------------------------ *
 *  library
 * ------------------------------------------------------------------ */

export async function loadLibrary(
  albums: Album[],
  onProgress: (p: number) => void = () => {},
): Promise<Map<string, CatalogEntry>> {
  try {
    await document.fonts?.ready;
  } catch {
    /* best effort */
  }

  let done = 0;
  const entries = await Promise.all(
    albums.map(async (album, i) => {
      let image: HTMLImageElement;
      let source: TexImageSource;
      try {
        image = await loadImage(album.coverUrl);
        source = image;
      } catch {
        const fb = fallbackCover(album, (i * 0.13) % 1);
        image = fb as unknown as HTMLImageElement;
        source = fb;
      }

      const palette = extractPalette(image as HTMLImageElement);
      const texture = new THREE.Texture(source);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;

      onProgress(++done / albums.length);

      return [
        album.id,
        {
          album: { ...album, palette },
          image: image as HTMLImageElement,
          texture,
          palette,
          spine: canvasTexture(drawSpine(album, palette)),
        } satisfies CatalogEntry,
      ] as const;
    }),
  );
  return new Map(entries);
}

/* ------------------------------------------------------------------ *
 *  spine
 * ------------------------------------------------------------------ */

function drawSpine(album: Album, p: Palette) {
  const W = 72;
  const H = 640;
  const c = makeCanvas(W, H);
  const ctx = c.getContext("2d")!;
  const [sh, ss, sl] = rgbToHsl(...p.spineRgb);
  const hi = hslToRgb(sh, ss * 0.9, Math.min(0.48, sl + 0.12));
  const lo = hslToRgb(sh, ss * 0.9, Math.max(0.05, sl - 0.09));

  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, css(hi));
  g.addColorStop(0.25, css(p.spineRgb));
  g.addColorStop(1, css(lo));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = p.accent;
  ctx.fillRect(8, 30, W - 16, 2);

  ctx.save();
  ctx.translate(W / 2 + 10, 54);
  ctx.rotate(Math.PI / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const title = album.title.replace(/\s+\(.*?\)\s*$/, "");
  let size = 30;
  const maxRun = H - 160;
  ctx.font = `700 ${size}px 'Noto Sans TC', 'Inter Tight', sans-serif`;
  let w = ctx.measureText(title).width;
  if (w > maxRun) {
    size = Math.max(15, Math.floor((size * maxRun) / w));
    ctx.font = `700 ${size}px 'Noto Sans TC', 'Inter Tight', sans-serif`;
    w = ctx.measureText(title).width;
  }
  ctx.fillStyle = p.ink;
  ctx.fillText(title, 0, 0);

  ctx.font = `500 ${Math.round(size * 0.42)}px 'Noto Sans TC', sans-serif`;
  ctx.globalAlpha = 0.75;
  ctx.fillText(album.artistZh, w + size * 0.7, 1);
  ctx.globalAlpha = 1;
  ctx.restore();

  return c;
}

/* ------------------------------------------------------------------ *
 *  disc
 * ------------------------------------------------------------------ */

export function drawDiscLabel(album: Album, p: Palette) {
  const S = 640;
  const c = makeCanvas(S, S);
  const ctx = c.getContext("2d")!;
  const R = S / 2;
  const [lh, ls, ll] = rgbToHsl(...p.spineRgb);

  // the substrate is aluminium with only a whisper of the album's hue
  const substrate = ctx.createRadialGradient(R * 0.52, R * 0.48, R * 0.06, R, R, R * 1.06);
  substrate.addColorStop(0, css(hslToRgb(lh, 0.05, 0.4)));
  substrate.addColorStop(0.45, css(hslToRgb(lh, 0.07, 0.6)));
  substrate.addColorStop(0.82, css(hslToRgb(lh, 0.09, 0.72)));
  substrate.addColorStop(1, css(hslToRgb(lh, 0.12, 0.55)));
  ctx.fillStyle = substrate;
  ctx.fillRect(0, 0, S, S);

  // faint optical rings
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    ctx.arc(R, R, R * (0.2 + i * 0.04), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${0.014 + (i % 3) * 0.01})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // printed label plate
  const plate = hslToRgb(lh, Math.min(0.42, ls * 0.55 + 0.06), Math.max(0.24, Math.min(0.42, ll + 0.14)));
  ctx.beginPath();
  ctx.arc(R, R, R * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = css(plate, 0.94);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(R, R, R * 0.5, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  const arc = (
    text: string,
    radius: number,
    start: number,
    dir: number,
    font: string,
    fill: string,
  ) => {
    ctx.save();
    ctx.translate(R, R);
    ctx.font = font;
    ctx.fillStyle = fill;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const chars = [...text];
    const gaps = chars.map((ch) => ctx.measureText(ch).width + 2);
    const total = gaps.reduce((a, b) => a + b, 0);
    let a = start - (dir * total) / radius / 2;
    chars.forEach((ch, i) => {
      const step = ((gaps[i] / 2) * dir) / radius;
      a += step;
      ctx.save();
      ctx.rotate(a);
      ctx.translate(0, -radius);
      ctx.rotate(dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      a += step;
    });
    ctx.restore();
  };

  arc(album.title, R * 0.78, Math.PI, 1, "600 24px 'Noto Sans TC', serif", "rgba(252,250,246,.95)");
  arc(album.artistName, R * 0.78, 0, -1, "500 17px 'Inter Tight', sans-serif", "rgba(252,250,246,.8)");

  ctx.fillStyle = "rgba(252,250,246,.9)";
  ctx.textAlign = "center";
  ctx.font = "600 13px 'Inter Tight', sans-serif";
  ctx.fillText(`${album.releaseYear} · ${album.genre.toUpperCase()}`, R, R - R * 0.18);

  // spindle hole stays open so the tray shows through
  ctx.beginPath();
  ctx.arc(R, R, R * 0.132, 0, Math.PI * 2);
  ctx.globalCompositeOperation = "destination-out";
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  ctx.beginPath();
  ctx.arc(R, R, R * 0.142, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,.3)";
  ctx.lineWidth = 2;
  ctx.stroke();

  return c;
}

export function grooveNormalMap(size = 512) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const R = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = (x - R) / R;
      const py = (y - R) / R;
      const r = Math.hypot(px, py);
      const a = Math.atan2(py, px);
      const slope = Math.cos(r * 300) * 0.55 * Math.min(1, r * 2.2);
      const nx = Math.cos(a) * slope;
      const ny = Math.sin(a) * slope;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const i = (y * size + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * 0.5 + 0.5) * 255;
      d[i + 2] = (nz * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ------------------------------------------------------------------ *
 *  back insert
 * ------------------------------------------------------------------ */

export function drawBackInsert(album: Album, p: Palette) {
  const W = 640;
  const H = 563;
  const c = makeCanvas(W, H);
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = css(p.darkRgb);
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.02})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
  }

  ctx.fillStyle = p.accent;
  ctx.fillRect(0, 0, W, 5);

  ctx.fillStyle = "rgba(244,240,232,.92)";
  ctx.font = "600 10px 'Inter Tight', sans-serif";
  ctx.fillText(album.artistName.toUpperCase(), 38, 48);

  ctx.font = "600 30px 'Newsreader', 'Noto Sans TC', serif";
  let title = album.title;
  while (ctx.measureText(title).width > W - 76 && title.length > 4) title = title.slice(0, -2);
  ctx.fillText(title, 38, 84);

  ctx.fillStyle = "rgba(244,240,232,.45)";
  ctx.font = "500 11px 'Inter Tight', sans-serif";
  ctx.fillText(`${album.releaseYear}  ·  ${album.genre}  ·  ${album.totalTracks} TRACKS`, 38, 106);

  ctx.strokeStyle = "rgba(244,240,232,.16)";
  ctx.beginPath();
  ctx.moveTo(38, 120);
  ctx.lineTo(W - 38, 120);
  ctx.stroke();

  const cols = album.tracks.length > 11 ? 2 : 1;
  const perCol = Math.ceil(album.tracks.length / cols);
  const colW = (W - 76) / cols;
  const rowH = Math.min(21, 320 / perCol);

  album.tracks.forEach((t, i) => {
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    const x = 38 + col * colW;
    const y = 146 + row * rowH;
    ctx.fillStyle = "rgba(244,240,232,.4)";
    ctx.font = "500 10px 'Inter Tight', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(String(t.trackNumber).padStart(2, "0"), x, y);
    ctx.fillStyle = "rgba(244,240,232,.85)";
    ctx.font = "400 11px 'Noto Sans TC', sans-serif";
    let name = t.title;
    const maxW = colW - 70;
    while (ctx.measureText(name).width > maxW && name.length > 4) name = name.slice(0, -2);
    if (name !== t.title) name = name.trimEnd() + "…";
    ctx.fillText(name, x + 22, y);
    ctx.fillStyle = "rgba(244,240,232,.35)";
    ctx.font = "500 9px 'Inter Tight', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(fmt(t.durationMs), x + colW - 24, y);
    ctx.textAlign = "left";
  });

  ctx.fillStyle = "rgba(244,240,232,.12)";
  ctx.fillRect(38, H - 84, W - 76, 1);
  ctx.fillStyle = p.accent;
  ctx.beginPath();
  ctx.arc(52, H - 48, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(p.darkRgb);
  ctx.beginPath();
  ctx.arc(52, H - 48, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(244,240,232,.5)";
  ctx.font = "600 9px 'Inter Tight', sans-serif";
  ctx.fillText("CD VAULT", 70, H - 52);
  ctx.globalAlpha = 0.45;
  ctx.font = "400 8px 'Inter Tight', sans-serif";
  ctx.fillText(`℗ ${album.releaseYear} ${album.artistName} · HONG KONG`, 70, H - 40);
  ctx.globalAlpha = 1;

  let bx = W - 168;
  let seed = Number(album.id.replace(/\D/g, "")) % 9973 || 1234;
  ctx.fillStyle = "rgba(244,240,232,.72)";
  while (bx < W - 40) {
    seed = (seed * 9301 + 49297) % 233280;
    const w = 1 + (seed % 3);
    ctx.fillRect(bx, H - 62, w, 28);
    bx += w + 1 + (seed % 2);
  }

  return c;
}

export const fmt = (ms: number) => {
  if (!ms) return "--:--";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/* ------------------------------------------------------------------ *
 *  plastic + shadow helpers
 * ------------------------------------------------------------------ */

/** faint handling marks, used as a roughness variation on the clear lid */
export function scratchRoughness(size = 512) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, size, size);
  ctx.lineCap = "round";
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 12 + Math.random() * 90;
    const a = (Math.random() - 0.5) * 0.9;
    ctx.strokeStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.16})`;
    ctx.lineWidth = 0.6 + Math.random() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  return canvasTexture(c, false);
}

/** a soft studio dome: what a mirror disc should reflect instead of void */
export function studioDome(size = 512) {
  const c = makeCanvas(size, size / 2);
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, size / 2);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.2, "#f7f2e8");
  g.addColorStop(0.42, "#ded6c6");
  g.addColorStop(0.55, "#a99f8e");
  g.addColorStop(0.72, "#6f6759");
  g.addColorStop(1, "#443f37");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function softShadowTexture(size = 256) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(40,32,24,0.55)");
  g.addColorStop(0.45, "rgba(40,32,24,0.28)");
  g.addColorStop(1, "rgba(40,32,24,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
