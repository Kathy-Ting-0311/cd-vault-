import type * as THREE from "three";

export interface Track {
  id: string;
  title: string;
  durationMs: number;
  trackNumber: number;
  spotifyUrl?: string;
  previewUrl?: string | null;
}

export interface Album {
  id: string;
  artistId: string;
  artistName: string;
  artistZh: string;
  artistLatin: string;
  title: string;
  releaseDate: string;
  releaseYear: number;
  albumType: string;
  genre: string;
  coverUrl: string;
  coverLarge: string;
  spotifyUrl?: string;
  spotifySearch: string;
  appleUrl: string;
  totalTracks: number;
  tracks: Track[];
  /** palette extracted from the artwork at load time */
  palette?: Palette;
}

export interface Palette {
  spine: string;
  spineRgb: [number, number, number];
  accent: string;
  accentRgb: [number, number, number];
  dark: string;
  darkRgb: [number, number, number];
  ink: string;
  avgLum: number;
}

export interface CatalogEntry {
  album: Album;
  image: HTMLImageElement;
  texture: THREE.Texture;
  palette: Palette;
  spine: THREE.Texture;
}

export type ArchiveState =
  | "browsing"
  | "selecting"
  | "extracting"
  | "case-opening"
  | "case-open"
  | "detail-opening"
  | "detail-open"
  | "detail-closing"
  | "returning";

/** Mutable values the render loop reads. Never stored in React state. */
export interface ArchiveControls {
  /** continuous position along the rack, in album units */
  index: number;
  /** where the rack is heading */
  target: number;
  /** 0..1 — active case pulled forward out of the arc */
  extract: number;
  /** 0..1 — jewel case lid hinge */
  open: number;
  /** 0..1 — camera pushed in on the case */
  cam: number;
  /** extra spin of the disc once open */
  disc: number;
}
