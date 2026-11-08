import { useEffect } from "react";

export default function About({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="about" role="dialog" aria-modal="true" aria-label="About this archive">
      <button className="sheet__close" onClick={onClose} aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="m3 3 10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>
      <div className="about__inner">
        <small>Private music archive</small>
        <h2>Twenty-one jewel cases, 1986 — 2022.</h2>
        <p>
          A rack of Cantopop and Mandopop CDs from G.E.M. 鄧紫棋, Joey Yung 容祖兒 and Jacky Cheung
          張學友. Drag, scroll or use the arrow keys to move along the rack. Click the centred case to
          lift it out; click it again to open the liner notes.
        </p>
        <p>
          Releases, tracklists and cover artwork come from the Apple Music catalogue. Spotify has no
          keyless album lookup, so the Spotify button opens a search for the release.
        </p>
        <small>← → browse · Enter open · Esc close</small>
      </div>
    </div>
  );
}
