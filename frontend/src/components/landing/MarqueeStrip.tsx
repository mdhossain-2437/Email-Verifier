/**
 * Infinite horizontal marquee used for "supported formats", "trusted by",
 * etc. Duplicates the children twice so the seam-less loop has content
 * on both sides at any scroll position. Pure CSS animation; no JS.
 *
 * Pauses on hover so users can read individual items. Honours
 * ``prefers-reduced-motion`` via a global rule in index.css.
 */

import type { ReactNode } from "react";

export function MarqueeStrip({
  children,
  duration = 36,
  className,
  pauseOnHover = true,
}: {
  children: ReactNode;
  /** Full-cycle duration in seconds. */
  duration?: number;
  className?: string;
  pauseOnHover?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)] ${
        className ?? ""
      }`}
    >
      <div
        className={`marquee-track flex gap-12 whitespace-nowrap will-change-transform ${
          pauseOnHover ? "hover:[animation-play-state:paused]" : ""
        }`}
        style={{ animationDuration: `${duration}s` }}
      >
        <div className="flex shrink-0 items-center gap-12">{children}</div>
        <div className="flex shrink-0 items-center gap-12" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
