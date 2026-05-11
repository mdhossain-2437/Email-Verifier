/**
 * A soft radial-gradient that follows the cursor over a section. Mounts
 * a fixed-position div, listens to pointer moves at the section level (so
 * the rest of the page isn't paying for it), and writes the cursor
 * position into a CSS custom property the gradient reads from.
 *
 * Pure CSS variables + a single rAF, no React renders per frame.
 *
 * Disabled when the user has ``prefers-reduced-motion: reduce`` or on
 * pointer types that aren't mouse (coarse pointers shouldn't see a
 * spotlight following a finger that just left the screen).
 */

import { useEffect, useRef } from "react";

export function CursorSpotlight({
  className,
  color = "rgba(195, 244, 0, 0.10)",
  radius = 360,
}: {
  className?: string;
  color?: string;
  radius?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const fine = window.matchMedia?.("(pointer: fine)").matches;
    if (prefersReducedMotion || !fine) {
      el.style.opacity = "0";
      return;
    }

    let raf = 0;
    let pendingX = 0;
    let pendingY = 0;
    const onMove = (e: PointerEvent) => {
      pendingX = e.clientX;
      pendingY = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--spotlight-x", `${pendingX}px`);
        el.style.setProperty("--spotlight-y", `${pendingY}px`);
        raf = 0;
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className={
        className ??
        "pointer-events-none fixed inset-0 z-[1] transition-opacity duration-500"
      }
      style={{
        background: `radial-gradient(${radius}px ${radius}px at var(--spotlight-x, -1000px) var(--spotlight-y, -1000px), ${color}, transparent 70%)`,
      }}
    />
  );
}
