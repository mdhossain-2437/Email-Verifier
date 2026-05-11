/**
 * Reusable brand mark for Saaf.
 *
 * The mark is a lime ✓ on a dark rounded square — Saaf means "clean",
 * so the brand glyph is the universal "clean / verified" sign.
 *
 * Two variants:
 *   - "mark": just the glyph (use for favicons, square slots).
 *   - "lockup": glyph + wordmark next to it (use in headers and footers).
 *
 * Pure SVG so it scales perfectly at any size with no font-loading flash.
 */

import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

type Variant = "mark" | "lockup";

interface SaafLogoProps {
  variant?: Variant;
  /** Tailwind size classes for the mark square (default: `w-9 h-9`). */
  markClassName?: string;
  /** Wordmark text size (default: `text-base`). */
  wordmarkClassName?: string;
  /** Optional className applied to the outer wrapper. */
  className?: string;
  /** Optional style applied to the outer wrapper. */
  style?: CSSProperties;
  /** Inverted: lime mark on dark squad → dark mark on lime square. */
  inverted?: boolean;
  /** Hide the bangla glyph next to the wordmark. */
  hideBangla?: boolean;
  /** Accessible label override. */
  label?: string;
}

export function SaafLogo({
  variant = "lockup",
  markClassName = "w-9 h-9",
  wordmarkClassName = "text-base",
  className,
  style,
  inverted = false,
  hideBangla = false,
  label = "Saaf — clean email lists",
}: SaafLogoProps) {
  const fill = inverted ? "#c3f400" : "#0e0e0e";
  const stroke = inverted ? "#0e0e0e" : "#c3f400";

  const mark = (
    <span
      className={cn(
        "inline-grid place-items-center rounded-2xl shrink-0 transition-transform",
        markClassName,
      )}
      style={{ backgroundColor: fill }}
      aria-hidden={variant === "lockup" ? true : undefined}
      role={variant === "mark" ? "img" : undefined}
      aria-label={variant === "mark" ? label : undefined}
    >
      <svg
        viewBox="0 0 64 64"
        className="w-[55%] h-[55%]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M14 33 L 26 45 L 52 19"
          stroke={stroke}
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );

  if (variant === "mark") {
    return (
      <span className={cn("inline-flex", className)} style={style}>
        {mark}
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex items-center gap-2.5", className)}
      style={style}
      role="img"
      aria-label={label}
    >
      {mark}
      <span
        className={cn(
          "font-display font-bold tracking-tight leading-none flex items-baseline gap-1.5",
          wordmarkClassName,
        )}
      >
        <span>saaf</span>
        {!hideBangla ? (
          <span
            aria-hidden
            className="font-display font-medium text-[0.72em] text-zinc-500 translate-y-[1px]"
          >
            সাফ
          </span>
        ) : null}
      </span>
    </span>
  );
}

export default SaafLogo;
