import raw from "../data/albums.json";
import type { Album, Track } from "../types";

const ARTIST_LATIN: Record<string, string> = {
  gem: "G.E.M.",
  joey: "Joey Yung",
  jacky: "Jacky Cheung",
};

const ARTIST_ORDER: Record<string, number> = { gem: 0, joey: 1, jacky: 2 };

type RawTrack = {
  n: number;
  disc: number;
  title: string;
  ms: number;
  preview: string | null;
};

type RawAlbum = {
  id: string;
  appleId: number;
  artistKey: string;
  artist: string;
  artistZh: string;
  title: string;
  year: number;
  genre: string;
  cover: string;
  trackCount: number;
  tracks: RawTrack[];
  spotifySearch: string;
  appleUrl: string;
};

const upscale = (url: string, size: number) =>
  url.replace(/\/\d+x\d+bb\.jpg$/, `/${size}x${size}bb.jpg`);

/** Chronological within each artist, artists in a fixed order — like a real shelf. */
export const ALBUMS: Album[] = (raw as RawAlbum[])
  .slice()
  .sort((a, b) => ARTIST_ORDER[a.artistKey] - ARTIST_ORDER[b.artistKey] || a.year - b.year)
  .map((a) => {
    const tracks: Track[] = a.tracks.map((t) => ({
      id: `${a.id}-t${t.n}`,
      title: t.title,
      durationMs: t.ms,
      trackNumber: t.n,
      previewUrl: t.preview,
    }));
    return {
      id: a.id,
      artistId: a.artistKey,
      artistName: ARTIST_LATIN[a.artistKey] ?? a.artist,
      artistZh: a.artistZh,
      artistLatin: a.artist,
      title: a.title,
      releaseDate: `${a.year}-01-01`,
      releaseYear: a.year,
      albumType: a.trackCount <= 6 ? "EP" : "Album",
      genre: a.genre,
      coverUrl: upscale(a.cover, 600),
      coverLarge: upscale(a.cover, 1000),
      spotifySearch: a.spotifySearch,
      appleUrl: a.appleUrl,
      totalTracks: a.trackCount,
      tracks,
    } satisfies Album;
  });

export const YEARS = Array.from(new Set(ALBUMS.map((a) => a.releaseYear))).sort(
  (a, b) => a - b,
);

export const ARTISTS = [
  { id: "gem", name: "G.E.M.", zh: "鄧紫棋", count: ALBUMS.filter((a) => a.artistId === "gem").length },
  { id: "joey", name: "Joey Yung", zh: "容祖兒", count: ALBUMS.filter((a) => a.artistId === "joey").length },
  { id: "jacky", name: "Jacky Cheung", zh: "張學友", count: ALBUMS.filter((a) => a.artistId === "jacky").length },
];

export const spotifyLink = (album: Album) => album.spotifyUrl ?? album.spotifySearch;
