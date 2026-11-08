import { useEffect, useRef, useState } from "react";
import { ARTISTS } from "../lib/albums";

export default function Nav({
  onRandom,
  onAbout,
  artist,
  onArtist,
  busy,
}: {
  onRandom: () => void;
  onAbout: () => void;
  artist: string;
  onArtist: (id: string) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <nav className="nav" aria-label="Primary">
      <div className="nav__brand">
        <strong>CD Vault</strong>
        <i>Private Music Archive</i>
      </div>

      <div className="nav__links" ref={ref}>
        <button
          className="nav__link"
          aria-current={!open && artist === "all" ? "true" : "false"}
          onClick={() => {
            onArtist("all");
            setOpen(false);
          }}
        >
          Collection
        </button>

        <div className="relative">
          <button
            className="nav__link"
            aria-current={artist !== "all" ? "true" : "false"}
            aria-expanded={open}
            aria-haspopup="true"
            onClick={() => setOpen((v) => !v)}
          >
            Artists
          </button>
          {open && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+10px)] min-w-[190px] border border-ink/15 bg-sheet p-2 text-[10px] tracking-[0.16em] text-ink shadow-[0_24px_50px_-24px_rgba(20,18,14,.5)]"
            >
              {[{ id: "all", name: "All artists", zh: "", count: ARTISTS.reduce((a, b) => a + b.count, 0) }, ...ARTISTS].map(
                (a) => (
                  <button
                    key={a.id}
                    role="menuitem"
                    onClick={() => {
                      onArtist(a.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-6 px-2 py-2 text-left transition-colors hover:text-cobalt ${
                      artist === a.id ? "text-cobalt" : ""
                    }`}
                  >
                    <span>
                      {a.name}
                      {a.zh ? <em className="ml-2 not-italic opacity-50">{a.zh}</em> : null}
                    </span>
                    <span className="opacity-40">{a.count}</span>
                  </button>
                ),
              )}
            </div>
          )}
        </div>

        <button className="nav__link" onClick={onRandom} disabled={busy}>
          Random Pick
        </button>
        <button className="nav__link" onClick={onAbout}>
          About
        </button>
        <button className="nav__menu" onClick={onAbout} aria-label="Menu">
          <i />
        </button>
      </div>
    </nav>
  );
}
