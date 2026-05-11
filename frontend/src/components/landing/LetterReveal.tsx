/**
 * Splits a heading into per-character spans and reveals them sequentially
 * via a CSS opacity + translate transition. Each character keeps an
 * inherited ``aria-hidden`` parent and the original word is preserved as
 * a screen-reader-only label, so assistive tech reads the heading as a
 * normal string.
 *
 * Trigger: first time the element scrolls into view.
 * Honours ``prefers-reduced-motion``.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";

interface LetterRevealProps {
  text: string;
  className?: string;
  /** Per-character stagger in ms. */
  stagger?: number;
  /** Initial Y offset (px) for each char before animating into place. */
  rise?: number;
}

export function LetterReveal({
  text,
  className,
  stagger = 22,
  rise = 28,
}: LetterRevealProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const chars = Array.from(text);

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="inline-block">
        {chars.map((c, i) => {
          const style: CSSProperties = {
            transitionDelay: `${i * stagger}ms`,
            transform: shown ? "translateY(0)" : `translateY(${rise}px)`,
            opacity: shown ? 1 : 0,
          };
          return (
            <span
              key={i}
              className="inline-block transition-[transform,opacity] duration-[700ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] will-change-transform whitespace-pre"
              style={style}
            >
              {c}
            </span>
          );
        })}
      </span>
    </span>
  );
}
