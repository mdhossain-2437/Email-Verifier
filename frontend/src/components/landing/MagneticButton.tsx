/**
 * Wraps a child so it gently tracks the cursor inside a hover region.
 * On enter, the child translates by a fraction of the cursor offset; on
 * leave it springs back via a CSS transition. Pointer-fine only — coarse
 * pointers never get magnetic behaviour because finger taps shouldn't
 * trigger sub-pixel drift.
 */

import { useEffect, useRef, type ReactNode } from "react";

export function MagneticButton({
  children,
  strength = 0.25,
  className,
}: {
  children: ReactNode;
  /** Fraction of the cursor offset to apply (0 = none, 1 = full follow). */
  strength?: number;
  className?: string;
}) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = wrap.current;
    const child = inner.current;
    if (!el || !child) return;
    const fine = window.matchMedia?.("(pointer: fine)").matches;
    if (!fine) return;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - (rect.left + rect.width / 2);
      const y = e.clientY - (rect.top + rect.height / 2);
      child.style.transform = `translate3d(${x * strength}px, ${y * strength}px, 0)`;
    };
    const onLeave = () => {
      child.style.transform = `translate3d(0, 0, 0)`;
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [strength]);

  return (
    <div ref={wrap} className={className}>
      <div
        ref={inner}
        className="will-change-transform transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
      >
        {children}
      </div>
    </div>
  );
}
