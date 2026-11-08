import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { Album } from "../types";
import { easeEditorial } from "../lib/ease";

export default function Timeline({
  albums,
  active,
  onPickYear,
}: {
  albums: Album[];
  active: Album;
  onPickYear: (year: number) => void;
}) {
  const years = Array.from(new Set(albums.map((a) => a.releaseYear))).sort((a, b) => a - b);
  const min = years[0];
  const max = years[years.length - 1];
  const span = Math.max(1, max - min);
  const pos = (y: number) => ((y - min) / span) * 100;

  const majorFrom = Math.ceil(min / 5) * 5;
  const majors: number[] = [];
  for (let y = majorFrom; y <= max; y += 5) majors.push(y);

  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cursorRef.current) return;
    gsap.to(cursorRef.current, {
      left: `${pos(active.releaseYear)}%`,
      duration: 0.75,
      ease: easeEditorial,
    });
  }, [active.releaseYear]);

  return (
    <section className="timeline" aria-label="Release timeline">
      <div className="timeline__head">
        <span>Timeline</span>
        <span>
          {min} — {max} · {albums.length} releases
        </span>
      </div>
      <div className="timeline__track">
        {years.map((y) => (
          <span
            key={y}
            className={`timeline__tick ${majors.includes(y) ? "is-major" : ""}`}
            style={{ left: `${pos(y)}%` }}
          />
        ))}

        {majors.map((y) => (
          <button
            key={y}
            className={`timeline__year ${active.releaseYear === y ? "is-active" : ""}`}
            style={{ left: `${pos(y)}%` }}
            onClick={() => onPickYear(y)}
          >
            {y}
          </button>
        ))}

        <div className="timeline__cursor" ref={cursorRef} style={{ left: `${pos(active.releaseYear)}%` }}>
          <span className="sr-only">{active.releaseYear}</span>
        </div>
      </div>
    </section>
  );
}
