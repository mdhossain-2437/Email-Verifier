/**
 * Counts a number up from 0 (or from a custom start) to ``value`` the
 * first time the element scrolls into view. Uses IntersectionObserver so
 * the animation never fires for users who never reach the section.
 *
 * Respects ``prefers-reduced-motion`` — in that case it shows the final
 * value immediately.
 */

import { useEffect, useRef, useState } from "react";

const editorialEase = (t: number) => 1 - Math.pow(1 - t, 3);

export function NumberCounter({
  value,
  duration = 1400,
  prefix = "",
  suffix = "",
  format = (n: number) => Math.round(n).toLocaleString(),
  className,
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [n, setN] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) {
      setN(value);
      return;
    }
    let raf = 0;
    let start = 0;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      setN(value * editorialEase(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            raf = requestAnimationFrame(tick);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {format(n)}
      {suffix}
    </span>
  );
}
