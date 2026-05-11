/**
 * Accordion FAQ block. Plain-English answers; no marketing fluff.
 *
 * Uses a controlled-by-state approach (not <details>) so we can animate
 * the height transition smoothly without relying on the browser's
 * default open/close behaviour.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";

export interface FAQItem {
  q: string;
  a: string;
}

export function FAQ({ items }: { items: FAQItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex items-center justify-between gap-6 py-5 sm:py-6 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-ink rounded-md"
            >
              <span className="font-display text-lg sm:text-xl font-semibold text-white tracking-tighter group-hover:text-lime transition-colors">
                {item.q}
              </span>
              <span
                className={`w-9 h-9 shrink-0 rounded-full border border-white/10 grid place-items-center transition-all ${
                  isOpen
                    ? "rotate-45 bg-lime text-ink border-lime"
                    : "text-zinc-300 group-hover:border-white/30"
                }`}
                aria-hidden
              >
                <Plus className="w-4 h-4" />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number] }}
                  className="overflow-hidden"
                >
                  <p className="pb-5 sm:pb-6 pr-12 text-sm sm:text-base text-zinc-400 leading-relaxed">
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
