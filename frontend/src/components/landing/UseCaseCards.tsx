/**
 * Use-case showcase cards. Each card is a self-contained mini case-study
 * with an icon, a person/role label, the problem they had, the outcome,
 * and a small numeric callout. Used on the landing page and the
 * dedicated /use-cases page.
 */

import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

export interface UseCase {
  role: string;
  title: string;
  body: string;
  metric: { value: string; label: string };
  icon: LucideIcon;
  href?: string;
}

export function UseCaseCards({ items }: { items: UseCase[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map(({ role, title, body, metric, icon: Icon, href }) => (
        <article
          key={title}
          className="surface-card-soft p-6 sm:p-7 group transition-all duration-300 hover:border-lime/30 hover:bg-ink-100/90 relative overflow-hidden flex flex-col"
        >
          <div
            className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-lime/[0.06] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            aria-hidden
          />
          <div className="relative flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-lime/[0.08] ring-1 ring-lime/25 grid place-items-center">
              <Icon className="w-4 h-4 text-lime" aria-hidden />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-400">
              {role}
            </span>
          </div>
          <h3 className="relative mt-5 font-display text-lg font-bold text-white tracking-tighter">
            {title}
          </h3>
          <p className="relative mt-3 text-sm text-zinc-400 leading-relaxed flex-1">
            {body}
          </p>
          <div className="relative mt-6 flex items-end justify-between">
            <div>
              <div className="font-display text-2xl font-bold text-lime tabular-nums">
                {metric.value}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                {metric.label}
              </div>
            </div>
            {href && (
              <Link
                to={href}
                className="inline-flex items-center gap-1 text-xs text-zinc-300 hover:text-lime transition-colors"
              >
                Read more <ArrowUpRight className="w-3.5 h-3.5" aria-hidden />
              </Link>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
