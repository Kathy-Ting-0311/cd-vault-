import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import type { Album } from "../types";
import { easeEditorial, easePaper } from "../lib/ease";
import { fmt } from "../lib/textures";

type Rect = { x: number; y: number; w: number; h: number };

/* ------------------------------------------------------------------ *
 *  ink bleed — seven expanding masks under a turbulence displacement
 * ------------------------------------------------------------------ */

const BLOBS = [
  [500, 500],
  [250, 260],
  [760, 300],
  [300, 760],
  [790, 720],
  [140, 520],
  [620, 140],
];

function InkReveal({ src, start }: { src: string; start: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!start) return;
    const circles = svgRef.current?.querySelectorAll("circle");
    if (!circles?.length) return;
    gsap.fromTo(
      circles,
      { attr: { r: 0 } },
      {
        attr: { r: 780 },
        duration: 1.05,
        ease: "power2.out",
        stagger: 0.07,
        delay: 0.36,
      },
    );
  }, [start]);

  return (
    <svg ref={svgRef} viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Album artwork">
      <defs>
        <filter id="ink-displace" x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.011 0.017" numOctaves="3" seed="9" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="26" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <mask id="ink-mask">
          <rect width="1000" height="1000" fill="black" />
          {BLOBS.map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={0} fill="white" />
          ))}
        </mask>
      </defs>
      <image
        href={src}
        width="1000"
        height="1000"
        preserveAspectRatio="xMidYMid slice"
        filter="url(#ink-displace)"
        mask="url(#ink-mask)"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */

export default function DetailSheet({
  album,
  coverRect,
  closing,
  onClose,
  onClosed,
}: {
  album: Album;
  coverRect: Rect;
  closing: boolean;
  onClose: () => void;
  onClosed: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef(coverRect);
  const [playing, setPlaying] = useState<number | null>(null);
  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const T = (v: number) => (reduced ? 0.01 : v);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const clipTo = (r: Rect, p: { top: number; right: number; bottom: number; left: number }, el: HTMLElement) => {
    el.style.clipPath = `inset(${p.top}px ${p.right}px ${p.bottom}px ${p.left}px)`;
  };

  useLayoutEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const r = rectRef.current;
    const proxy = {
      top: r.y,
      right: Math.max(0, vw - (r.x + r.w)),
      bottom: Math.max(0, vh - (r.y + r.h)),
      left: r.x,
    };
    const update = () => clipTo(r, proxy, el);
    update();

    const tl = gsap.timeline();
    tl.to(proxy, {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      duration: T(1.05),
      ease: (t: number) => easePaper(t),
      onUpdate: update,
    });
    tl.fromTo(
      el.querySelectorAll("[data-reveal]"),
      { yPercent: 112 },
      { yPercent: 0, duration: T(0.85), stagger: T(0.055), ease: easeEditorial },
      0.5,
    );
    tl.fromTo(el.querySelectorAll("[data-fade]"), { opacity: 0 }, { opacity: 1, duration: 0.6 }, 0.95);

    return () => {
      tl.kill();
      audioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    if (!closing) return;
    const el = sheetRef.current;
    if (!el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const r = rectRef.current;
    const proxy = { top: 0, right: 0, bottom: 0, left: 0 };
    const update = () => clipTo(r, proxy, el);
    gsap.to(el.querySelectorAll("[data-reveal]"), {
      yPercent: -112,
      duration: T(0.32),
      stagger: T(0.018),
      ease: "power2.in",
    });
    gsap.to(proxy, {
      top: r.y,
      right: Math.max(0, vw - (r.x + r.w)),
      bottom: Math.max(0, vh - (r.y + r.h)),
      left: r.x,
      duration: T(0.78),
      ease: (t: number) => easePaper(t),
      onUpdate: update,
      onComplete: onClosed,
    });
    audioRef.current?.pause();
  }, [closing, onClosed]);

  const play = (n: number, preview?: string | null) => {
    if (!preview) return;
    if (playing === n) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    audio.src = preview;
    audio.play().catch(() => setPlaying(null));
    audio.onended = () => setPlaying(null);
    setPlaying(n);
  };

  useEffect(() => () => audioRef.current?.pause(), []);

  return (
    <div className="sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-label={`${album.title} details`}>
      <button className="sheet__close" onClick={onClose} aria-label="Close album details">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="m3 3 10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>

      <div className="sheet__inner">
        <div className="sheet__col sheet__col--left">
          <div className="mask">
            <span data-reveal className="sheet__artist">
              {album.artistName}
            </span>
          </div>

          <div className="mask">
            <h2 data-reveal className="sheet__title">
              {album.title}
            </h2>
          </div>

          <div className="mask">
            <p data-reveal className="sheet__zh">
              {album.artistZh}
            </p>
          </div>

          <div data-fade className="sheet__facts">
            <span>
              Released
              <b>{album.releaseYear}</b>
            </span>
            <span>
              Genre
              <b>{album.genre}</b>
            </span>
            <span>
              Tracks
              <b>{album.totalTracks}</b>
            </span>
            <span>
              Format
              <b>{album.albumType}</b>
            </span>
          </div>

          <div className="sheet__rule" data-fade />

          <div data-fade className="tracklist">
            {album.tracks.map((t) => (
              <button
                key={t.id}
                className={`track ${playing === t.trackNumber ? "is-playing" : ""}`}
                onClick={() => play(t.trackNumber, t.previewUrl)}
                aria-label={`${playing === t.trackNumber ? "Pause" : "Preview"} ${t.title}`}
              >
                <span className="track__n">{String(t.trackNumber).padStart(2, "0")}</span>
                <span className="track__t">{t.title}</span>
                <span className="track__d">{fmt(t.durationMs)}</span>
              </button>
            ))}
          </div>

          <div data-fade className="mt-7 flex flex-wrap items-center gap-4">
            <a className="spotify" href={album.spotifyUrl ?? album.spotifySearch} target="_blank" rel="noreferrer">
              <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
                <circle cx="12" cy="12" r="10" fill="currentColor" />
                <path d="M7.2 9.4c3.4-1 7.3-.6 9.9 1M7.8 12.4c2.7-.8 5.7-.5 7.9.9M8.4 15.2c2.1-.6 4.4-.4 6.1.7" stroke="var(--sheet)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              </svg>
              Listen on Spotify
            </a>
            <button className="nav__link !text-[10px] !tracking-[0.18em] !normal-case text-muted" onClick={onClose}>
              Return to the rack
            </button>
          </div>

          <p data-fade className="sheet__note">
            Metadata and artwork from the Apple Music catalogue. Spotify has no keyless album lookup, so
            the button opens a Spotify search for this release. Click any track to hear a 30-second preview.
          </p>
        </div>

        <div className="sheet__col sheet__col--right">
          <div className="artwork" data-fade>
            <div className="artwork__disc" aria-hidden />
            <div className="artwork__art">
              <InkReveal src={album.coverLarge} start={!closing} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
