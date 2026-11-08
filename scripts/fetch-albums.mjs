import { writeFile } from "node:fs/promises";

const PICKS = [
  { id: 6775748908, artist: "gem" }, { id: 6775749474, artist: "gem" },
  { id: 6776100461, artist: "gem" }, { id: 6775778892, artist: "gem" },
  { id: 1053567923, artist: "gem" }, { id: 1491477500, artist: "gem" },
  { id: 1641502284, artist: "gem" },
  { id: 542187857, artist: "joey" }, { id: 542212024, artist: "joey" },
  { id: 542188180, artist: "joey" }, { id: 541932104, artist: "joey" },
  { id: 541904926, artist: "joey" }, { id: 1123572915, artist: "joey" },
  { id: 1594495552, artist: "joey" },
  { id: 1443314619, artist: "jacky" }, { id: 1443840130, artist: "jacky" },
  { id: 1443431909, artist: "jacky" }, { id: 1443792605, artist: "jacky" },
  { id: 1444065611, artist: "jacky" }, { id: 1443897807, artist: "jacky" },
  { id: 1443307419, artist: "jacky" },
];

const ARTISTS = {
  gem: { name: "G.E.M.", zh: "鄧紫棋" },
  joey: { name: "Joey Yung", zh: "容祖兒" },
  jacky: { name: "Jacky Cheung", zh: "張學友" },
};

const out = [];
for (const pick of PICKS) {
  const url = `https://itunes.apple.com/lookup?id=${pick.id}&entity=song&limit=200&country=hk`;
  const json = await (await fetch(url)).json();
  const album = json.results.find((r) => r.wrapperType === "collection");
  const songs = json.results
    .filter((r) => r.wrapperType === "track" && r.kind === "song")
    .sort((a, b) => a.discNumber - b.discNumber || a.trackNumber - b.trackNumber);

  const cover = album.artworkUrl100.replace(/\/\d+x\d+bb\.jpg$/, "/600x600bb.jpg");
  out.push({
    id: `it-${pick.id}`,
    appleId: pick.id,
    artistKey: pick.artist,
    artist: ARTISTS[pick.artist].name,
    artistZh: ARTISTS[pick.artist].zh,
    title: album.collectionName.replace(/\s*-\s*EP$/, "").trim(),
    year: Number(album.releaseDate.slice(0, 4)),
    genre: album.primaryGenreName,
    cover,
    trackCount: songs.length,
    tracks: songs.map((s, i) => ({
      n: i + 1,
      disc: s.discNumber,
      title: s.trackName,
      ms: s.trackTimeMillis ?? 0,
      preview: s.previewUrl ?? null,
    })),
    spotifySearch: `https://open.spotify.com/search/${encodeURIComponent(
      `${ARTISTS[pick.artist].name} ${album.collectionName}`,
    )}`,
    appleUrl: album.collectionViewUrl,
  });
  console.log(`${out.at(-1).year}  ${out.at(-1).artist.padEnd(13)} ${out.at(-1).title}  (${songs.length} tracks)`);
}
await writeFile("src/data/albums.json", JSON.stringify(out, null, 2));
console.log(`\nwrote ${out.length} albums`);
