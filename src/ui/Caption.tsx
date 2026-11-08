import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import type { Album } from "../types";
import { easeEditorial } from "../lib/ease";

const hasCJK = (s: string) => /[㐀-鿿]/.test(s);

export default function Caption({
  album,
  onPrev,
  onNext,
  disabled,
}: {
  album: Album;
  onPrev: () => void;
  onNext: () => void;
  disabled: boolean;
}) {
  const [shown, setShown] = useState(album);
  const rootRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  const reduced = useRef(
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (album.id === shown.id) return;
    if (reduced.current) {
      setShown(album);
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    const lines = el.querySelectorAll<HTMLElement>("[data-line]");
    gsap.killTweensOf(lines);
    gsap.to(lines, {
      yPercent: -110,
      duration: 0.28,
      ease: easeEditorial,
      stagger: 0.035,
    });
    gsap.delayedCall(0.29, () => setShown(album));
  }, [album, shown.id]);

  useLayoutEffect(() => {
    if (reduced.current) return;
    const el = rootRef.current;
    if (!el) return;
    const lines = el.querySelectorAll<HTMLElement>("[data-line]");
    gsap.killTweensOf(lines);
    gsap.fromTo(
      lines,
      { yPercent: first.current ? 105 : 110 },
      {
        yPercent: 0,
        duration: first.current ? 0.9 : 0.44,
        ease: easeEditorial,
        stagger: first.current ? 0.08 : 0.045,
        delay: first.current ? 0.15 : 0.02,
      },
    );
    first.current = false;
  }, [shown.id]);

  return (
    <div className="caption" ref={rootRef}>
      <div className="caption__arrows">
        <button className="arrow" onClick={onPrev} disabled={disabled} aria-label="Previous album">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M8.5 2.5 4 7l4.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="arrow" onClick={onNext} disabled={disabled} aria-label="Next album">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M5.5 2.5 10 7l-4.5 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <p className="mask caption__eyebrow">
        <span data-line>{shown.artistName}</span>
      </p>

      <h1 className="mask caption__title">
        <span data-line>{shown.title}</span>
      </h1>

      <div className="mask caption__meta">
        <span data-line>
          <b>{shown.releaseYear}</b> — {shown.genre} · {shown.totalTracks} tracks · {shown.albumType}
        </span>
      </div>
    </div>
  );
}
