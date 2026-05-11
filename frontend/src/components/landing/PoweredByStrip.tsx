/**
 * "Powered by" section — credits the free-tier services that make Saaf
 * possible. Each logo-pill links to the provider's site.
 *
 * Kept minimal: a soft horizontal strip with SVG wordmarks / short
 * names and a one-liner explaining what each service lets us give away
 * for free.
 */

import { motion, type Variants } from "framer-motion";

const editorialEase: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
const reveal: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: editorialEase, delay: 0.05 * i },
  }),
};

interface Provider {
  name: string;
  role: string;
  url: string;
  icon: () => React.ReactNode;
}

const PROVIDERS: Provider[] = [
  {
    name: "Vercel",
    role: "Frontend hosting & CDN",
    url: "https://vercel.com",
    icon: () => (
      <svg viewBox="0 0 76 65" className="w-4 h-4" fill="currentColor" aria-hidden>
        <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
      </svg>
    ),
  },
  {
    name: "Fly.io",
    role: "Always-on free backend",
    url: "https://fly.io",
    icon: () => (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden>
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
  },
  {
    name: "Render",
    role: "Free-tier backend fallback",
    url: "https://render.com",
    icon: () => (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="3" />
      </svg>
    ),
  },
  {
    name: "Firebase",
    role: "Auth, Firestore, analytics",
    url: "https://firebase.google.com",
    icon: () => (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden>
        <path d="M3.89 15.67L6.22 2.94c.08-.45.69-.48.82-.04l2.56 8.78 8.52-4.96c.38-.22.85.09.75.5L16.08 22 3.89 15.67z" />
      </svg>
    ),
  },
  {
    name: "Cloudflare",
    role: "DNS & DDoS protection",
    url: "https://cloudflare.com",
    icon: () => (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden>
        <path d="M16.5 15.5c.2-.7 0-1.3-.5-1.7-.5-.3-1-.5-1.6-.5H7.8c-.2 0-.3-.1-.3-.3v-.1c0-.1.1-.3.3-.3h6.8c1-.1 2.1-.8 2.5-1.8.2-.5.3-1 .2-1.5-.2-1.4-1.5-2.4-2.9-2.3-1.1.1-2 .7-2.5 1.6-.4-.5-.9-.7-1.5-.7-.9 0-1.7.7-1.8 1.6 0 .2 0 .4.1.6-1.6.1-2.9 1.4-2.9 3.1 0 .2 0 .3.1.5.1.2.2.3.4.3h10.2c.2 0 .4-.1.5-.3.1-.1.2-.2.2-.3l.3-.8zM19.3 14.6c0-.1-.1-.2-.3-.2h-.5c-.1 0-.2.1-.3.2-.4 1.1-1.5 1.9-2.7 1.9h-.1c-.1 0-.2.1-.2.2v.2c0 .1.1.2.2.2h.1c1.6 0 3-1 3.5-2.3l.3-.2z" />
      </svg>
    ),
  },
  {
    name: "GitHub",
    role: "Source control & CI",
    url: "https://github.com",
    icon: () => (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden>
        <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69C6.73 19.91 6.14 17.97 6.14 17.97c-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.93 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.58 9.58 0 0112 6.8c.85.004 1.71.11 2.51.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.16.59.67.5A10.02 10.02 0 0022 12c0-5.52-4.48-10-10-10z" />
      </svg>
    ),
  },
];

export function PoweredByStrip() {
  return (
    <section className="px-4 sm:px-6 lg:px-10 py-16 max-w-shell mx-auto border-t border-white/[0.05]">
      <div className="text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
          Free forever because of
        </div>
      </div>
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        variants={reveal}
        custom={0}
        className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
      >
        {PROVIDERS.map((p, i) => (
          <motion.a
            key={p.name}
            href={p.url}
            target="_blank"
            rel="noreferrer"
            variants={reveal}
            custom={i}
            className="group flex flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-ink/40 p-4 hover:border-lime/20 hover:bg-lime/[0.04] transition-colors min-h-[100px] justify-center text-center"
          >
            <div className="text-zinc-400 group-hover:text-lime transition-colors">
              {p.icon()}
            </div>
            <div className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">
              {p.name}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-zinc-500 group-hover:text-zinc-400 transition-colors leading-tight">
              {p.role}
            </div>
          </motion.a>
        ))}
      </motion.div>
    </section>
  );
}
