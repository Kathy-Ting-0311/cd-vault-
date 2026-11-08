import { useEffect, useRef } from "react";
import gsap from "gsap";

export type CursorMode = "default" | "open" | "select" | "pointer";

export default function Cursor({ mode }: { mode: CursorMode }) {
  const ref = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const move = useRef<((x: number) => void) | null>(null);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    document.documentElement.classList.add("has-cursor");
    const el = ref.current!;
    gsap.set(el, { xPercent: -50, yPercent: -50, x: -100, y: -100 });
    move.current = gsap.quickTo(el, "x", { duration: 0.42, ease: "power3" }) as (x: number) => void;
    const moveY = gsap.quickTo(el, "y", { duration: 0.42, ease: "power3" }) as (y: number) => void;

    const onMove = (e: PointerEvent) => {
      move.current?.(e.clientX);
      moveY(e.clientY);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.classList.remove("has-cursor");
    };
  }, []);

  const label = mode === "open" ? "Open" : mode === "select" ? "Select" : "";

  useEffect(() => {
    if (labelRef.current) labelRef.current.textContent = label;
  }, [label]);

  if (typeof window !== "undefined" && !window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    return null;
  }

  return (
    <div ref={ref} className="cursor" data-mode={mode} aria-hidden="true">
      <span ref={labelRef} />
    </div>
  );
}
