import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import ArchiveScene from "./three/ArchiveScene";
import Nav from "./ui/Nav";
import Caption from "./ui/Caption";
import Timeline from "./ui/Timeline";
import DetailSheet from "./ui/DetailSheet";
import Cursor, { type CursorMode } from "./ui/Cursor";
import About from "./ui/About";
import { ALBUMS } from "./lib/albums";
import { wrapSigned } from "./lib/arc";
import { loadLibrary } from "./lib/textures";
import type { ArchiveControls, ArchiveState, CatalogEntry } from "./types";

type Rect = { x: number; y: number; w: number; h: number };

const prefersReduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function App() {
  const [entries, setEntries] = useState<CatalogEntry[] | null>(null);
  const [progress, setProgress] = useState(0);
  const [state, _setState] = useState<ArchiveState>("browsing");
  const [activeIndex, setActiveIndex] = useState(0);
  const [artist, setArtist] = useState("all");
  const [about, setAbout] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [coverRect, setCoverRect] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });

  const stateRef = useRef<ArchiveState>("browsing");
  const setState = useCallback((s: ArchiveState) => {
    stateRef.current = s;
    _setState(s);
  }, []);

  const ctrl = useRef<ArchiveControls>({
    index: 0,
    target: 0,
    extract: 0,
    open: 0,
    cam: 0,
    disc: 0,
  });
  const rectRef = useRef<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const drag = useRef({ down: false, last: 0, moved: 0 });
  const lastWheel = useRef(0);
  const reduced = useRef(prefersReduced());
  const dur = (v: number) => (reduced.current ? 0.01 : v);

  /* ---- catalogue ------------------------------------------------ */
  useEffect(() => {
    let alive = true;
    loadLibrary(ALBUMS, (p) => alive && setProgress(p)).then((map) => {
      if (!alive) return;
      setEntries(ALBUMS.map((a) => map.get(a.id)!));
    });
    return () => {
      alive = false;
    };
  }, []);

  const visible = useMemo(
    () => (entries ?? []).filter((e) => artist === "all" || e.album.artistId === artist),
    [entries, artist],
  );

  const activeAlbum = visible[activeIndex]?.album ?? visible[0]?.album ?? ALBUMS[0];

  useEffect(() => {
    ctrl.current.index = 0;
    ctrl.current.target = 0;
    setActiveIndex(0);
  }, [artist]);

  /* ---- state machine -------------------------------------------- */
  const extract = useCallback(() => {
    const s = stateRef.current;
    if (s !== "browsing" && s !== "selecting") return;
    setState("extracting");
    const c = ctrl.current;
    const tl = gsap.timeline({ onComplete: () => setState("case-opening") });
    tl.to(c, { cam: 1, duration: dur(0.95), ease: "power2.inOut" }, 0);
    tl.to(c, { extract: 1, duration: dur(0.82), ease: "power3.out" }, 0.08);
  }, [setState]);

  useEffect(() => {
    if (state !== "case-opening") return;
    const tween = gsap.to(ctrl.current, {
      open: 1,
      duration: dur(1.15),
      ease: "power2.inOut",
      onComplete: () => setState("case-open"),
    });
    return () => {
      tween.kill();
    };
  }, [state, setState]);

  useEffect(() => {
    if (state !== "returning") return;
    const c = ctrl.current;
    const tl = gsap.timeline({ onComplete: () => setState("browsing") });
    tl.to(c, { open: 0, duration: dur(0.85), ease: "power2.inOut" }, 0);
    tl.to(c, { extract: 0, duration: dur(0.95), ease: "power2.inOut" }, dur(0.5));
    tl.to(c, { cam: 0, duration: dur(1.05), ease: "power2.inOut" }, dur(0.55));
    return () => {
      tl.kill();
    };
  }, [state, setState]);

  const openDetail = useCallback(() => {
    if (stateRef.current !== "case-open") return;
    setCoverRect({ ...rectRef.current });
    setState("detail-open");
  }, [setState]);

  const closeDetail = useCallback(() => {
    if (stateRef.current !== "detail-open") return;
    setState("detail-closing");
  }, [setState]);

  const onSheetClosed = useCallback(() => setState("returning"), [setState]);

  /* ---- navigation ----------------------------------------------- */
  const moveTo = useCallback(
    (i: number) => {
      const n = visible.length;
      if (!n) return;
      const delta = wrapSigned(i - Math.round(ctrl.current.index), n);
      ctrl.current.target = Math.round(ctrl.current.index) + delta;
    },
    [visible.length],
  );

  const step = useCallback((dir: number) => {
    if (stateRef.current !== "browsing") return;
    ctrl.current.target = Math.round(ctrl.current.target) + dir;
  }, []);

  const random = useCallback(() => {
    if (stateRef.current !== "browsing") return;
    const n = visible.length;
    if (!n) return;
    let pick = Math.floor(Math.random() * n);
    if (n > 1 && pick === activeIndex) pick = (activeIndex + 1 + Math.floor(Math.random() * (n - 1))) % n;
    const base = Math.round(ctrl.current.target);
    const delta = ((pick - (base % n)) % n + n) % n;
    ctrl.current.target = base + n + delta;
    setState("selecting");
    gsap.delayedCall(1.75, () => {
      if (stateRef.current !== "selecting") return;
      setActiveIndex(pick);
      extract();
    });
  }, [visible.length, activeIndex, extract, setState]);

  const onIndexChange = useCallback((k: number) => {
    if (stateRef.current === "selecting") return;
    setActiveIndex(k);
  }, []);

  const handleSelect = useCallback(
    (i: number) => {
      if (drag.current.moved > 8) return;
      const s = stateRef.current;
      if (s === "browsing") {
        if (i === activeIndex) extract();
        else moveTo(i);
      } else if (s === "case-open" && i === activeIndex) {
        openDetail();
      }
    },
    [activeIndex, extract, moveTo, openDetail],
  );

  const pickYear = useCallback(
    (year: number) => {
      if (stateRef.current !== "browsing") return;
      let best = 0;
      let bestD = Infinity;
      visible.forEach((e, i) => {
        const d = Math.abs(e.album.releaseYear - year);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      moveTo(best);
    },
    [visible, moveTo],
  );

  /* ---- pointer -------------------------------------------------- */
  const onPointerDown = (e: React.PointerEvent) => {
    if (stateRef.current !== "browsing") return;
    drag.current = { down: true, last: e.clientX, moved: 0 };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.down) return;
    const dx = e.clientX - d.last;
    d.last = e.clientX;
    d.moved += Math.abs(dx);
    ctrl.current.target -= dx / 210;
  };
  const onPointerUp = () => {
    if (!drag.current.down) return;
    drag.current.down = false;
    ctrl.current.target = Math.round(ctrl.current.target);
  };
  const onWheel = (e: React.WheelEvent) => {
    if (stateRef.current !== "browsing") return;
    const now = performance.now();
    if (now - lastWheel.current < 140) return;
    lastWheel.current = now;
    const dir = Math.sign(e.deltaY) || Math.sign(e.deltaX);
    if (dir) step(dir);
  };

  /* ---- keyboard ------------------------------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "Enter") {
        if (s === "browsing") extract();
        else if (s === "case-open") openDetail();
      } else if (e.key === "Escape") {
        if (about) setAbout(false);
        else if (s === "detail-open") closeDetail();
        else if (s === "case-open") setState("returning");
      } else if (e.key.toLowerCase() === "r" && !e.metaKey && !e.ctrlKey) random();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, extract, openDetail, closeDetail, random, setState, about]);

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__v2 = { state, activeIndex, ctrl };
  }, [state, activeIndex]);

  const locked = state !== "browsing";
  const caseMode: CursorMode = hoverId
    ? hoverId === activeAlbum.id
      ? "open"
      : "select"
    : "default";

  const sheetMounted = state === "detail-open" || state === "detail-closing";

  return (
    <div className="relative h-full w-full">
      <div className="paper-grain" aria-hidden />
      <div className="bg-type" aria-hidden>
        <span>音樂</span>
        <span>回憶</span>
      </div>
      <div className="edge-fade edge-fade--l" aria-hidden />
      <div className="edge-fade edge-fade--r" aria-hidden />

      {entries && (
        <>
          <div
            className="fixed inset-0 z-[2]"
            style={{ touchAction: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
          >
            <ArchiveScene
              entries={visible}
              ctrl={ctrl}
              activeIndex={activeIndex}
              onSelect={handleSelect}
              onHover={setHoverId}
              onIndexChange={onIndexChange}
              locked={locked}
              rectRef={rectRef}
            />
          </div>

          <Nav
            onRandom={random}
            onAbout={() => setAbout(true)}
            artist={artist}
            onArtist={setArtist}
            busy={state !== "browsing"}
          />

          <button
            className="random"
            onClick={random}
            disabled={state !== "browsing"}
            aria-label="Surprise me, pick a CD"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 7.5h2.6c1.2 0 2.3.6 3 1.6l4 6c.7 1 1.8 1.6 3 1.6H20M4 16.5h2.6c1.2 0 2.3-.6 3-1.6l.7-1M14.9 9.2l.7-1c.7-1 1.8-1.6 3-1.6H20"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path d="m17.6 4.9 2.3 2.6-2.3 2.6M17.6 13.4l2.3 2.6-2.3 2.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Surprise me — pick a CD
          </button>

          <Caption album={activeAlbum} onPrev={() => step(-1)} onNext={() => step(1)} disabled={locked} />
          <Timeline albums={visible.map((e) => e.album)} active={activeAlbum} onPickYear={pickYear} />
        </>
      )}

      {sheetMounted && (
        <DetailSheet
          album={activeAlbum}
          coverRect={coverRect}
          closing={state === "detail-closing"}
          onClose={closeDetail}
          onClosed={onSheetClosed}
        />
      )}

      {about && <About onClose={() => setAbout(false)} />}

      <Cursor mode={caseMode} />

      {!entries && (
        <div className="loader">
          <div className="text-center">
            <div className="loader__disc mx-auto" />
            <p className="loader__label">
              Cataloguing the rack · {Math.round(progress * 100)}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
