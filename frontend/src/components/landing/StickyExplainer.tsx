/**
 * Sticky-scroll explainer used on the landing page.
 *
 * Layout: two-column desktop, single-column mobile. The left column lists
 * the steps as cards. The right column shows a sticky illustration that
 * swaps in sync with the user's scroll position — IntersectionObserver
 * tracks which step is in view and updates the active panel.
 *
 * Mobile fallback: cards stack normally and the illustration sits inside
 * each card. Sticky behaviour only activates on ``md+`` widths.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface ExplainerStep {
  index: string;
  title: string;
  body: string;
  visual: ReactNode;
}

export function StickyExplainer({ steps }: { steps: ExplainerStep[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        // Pick the topmost intersecting entry.
        let best: { index: number; ratio: number } | null = null;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const idx = Number((e.target as HTMLElement).dataset.idx);
          if (!best || e.intersectionRatio > best.ratio) {
            best = { index: idx, ratio: e.intersectionRatio };
          }
        }
        if (best) setActive(best.index);
      },
      { threshold: [0.35, 0.6, 0.85] },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [steps.length]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10">
      <div className="md:col-span-7 space-y-5">
        {steps.map((step, i) => (
          <div
            key={step.index}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-idx={i}
            className={`surface-card-soft p-6 sm:p-8 transition-colors duration-300 ${
              active === i
                ? "bg-ink-100/90 border-lime/25"
                : "hover:border-white/[0.10]"
            }`}
          >
            <div className="flex items-baseline gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400">
              <span className="text-lime">/ {step.index}</span>
              <span>step {i + 1} of {steps.length}</span>
            </div>
            <h3 className="mt-3 font-display text-2xl sm:text-3xl font-bold text-white tracking-tighter">
              {step.title}
            </h3>
            <p className="mt-3 text-sm sm:text-base text-zinc-400 leading-relaxed">
              {step.body}
            </p>
            <div className="mt-6 md:hidden">{step.visual}</div>
          </div>
        ))}
      </div>
      <div className="hidden md:block md:col-span-5">
        <div className="sticky top-24">
          <div className="surface-card p-6 sm:p-8 aspect-[4/5] relative overflow-hidden">
            {steps.map((step, i) => (
              <div
                key={step.index}
                className={`absolute inset-0 p-6 sm:p-8 flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
                  active === i
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-4 pointer-events-none"
                }`}
                aria-hidden={active !== i}
              >
                {step.visual}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
