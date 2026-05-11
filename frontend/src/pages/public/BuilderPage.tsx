/**
 * /builder — "About the builder" page.
 *
 * Long-form story behind Saaf, pulled from delowarhossain.dev and
 * 2027.delowarhossain.dev. Photo, bio paragraphs, milestones timeline,
 * awards row, and a final CTA back to the product.
 */

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Award,
  AtSign,
  Github,
  Globe,
  Linkedin,
  MapPin,
  Sparkles,
  Twitter,
} from "lucide-react";

import { PublicLayout } from "@/components/landing/PublicLayout";
import {
  BRAND_DESCRIPTION_SHORT,
  BRAND_NAME,
  BRAND_TAGLINE,
  BUILDER_AWARDS,
  BUILDER_BIO,
  BUILDER_MILESTONES,
  CONTACT_EMAIL,
  FOLIO_URL,
  GITHUB_PROFILE,
  PORTFOLIO_URL,
  SOCIAL_LINKS,
} from "@/lib/brand";

const EDITORIAL_EASE = [0.2, 0.8, 0.2, 1] as const;

const reveal = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EDITORIAL_EASE, delay: i * 0.06 },
  }),
};

const SOCIAL_ITEMS = [
  { key: "github", label: "GitHub", icon: Github, href: GITHUB_PROFILE },
  { key: "twitter", label: "X / Twitter", icon: Twitter, href: SOCIAL_LINKS.twitter },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, href: SOCIAL_LINKS.linkedin },
  { key: "email", label: "Email", icon: AtSign, href: `mailto:${CONTACT_EMAIL}` },
  { key: "portfolio", label: "Portfolio", icon: Globe, href: PORTFOLIO_URL },
  { key: "folio2027", label: "2027 folio", icon: Sparkles, href: FOLIO_URL },
].filter((s) => s.href);

export function BuilderPage() {
  useEffect(() => {
    document.title = `The builder behind ${BRAND_NAME}`;
  }, []);

  return (
    <PublicLayout>
      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 60% at 80% 10%, rgba(195,244,0,0.10), transparent 60%), radial-gradient(40% 40% at 20% 0%, rgba(195,244,0,0.04), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
        <div className="relative px-4 sm:px-6 lg:px-10 pt-16 sm:pt-24 pb-16 max-w-shell mx-auto">
          <motion.div
            initial="hidden"
            animate="show"
            variants={reveal}
            custom={0}
            className="inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/[0.06] backdrop-blur px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-lime"
          >
            <Sparkles className="w-3 h-3" aria-hidden /> Built by one person
          </motion.div>

          <div className="mt-8 grid lg:grid-cols-[1.2fr_1fr] gap-10 lg:gap-16 items-center">
            <div>
              <motion.h1
                initial="hidden"
                animate="show"
                variants={reveal}
                custom={1}
                className="font-display font-bold tracking-tightest text-display-xl sm:text-display-2xl leading-[0.96]"
              >
                The builder behind
                <br />
                <span className="text-lime">{BRAND_NAME}.</span>
              </motion.h1>
              <motion.p
                initial="hidden"
                animate="show"
                variants={reveal}
                custom={2}
                className="mt-6 max-w-2xl text-base sm:text-lg text-zinc-300 leading-relaxed"
              >
                {BRAND_NAME} was designed and engineered solo. No team, no
                investors, no enterprise pricing. {BRAND_DESCRIPTION_SHORT}
              </motion.p>

              <motion.div
                initial="hidden"
                animate="show"
                variants={reveal}
                custom={3}
                className="mt-8 flex flex-wrap items-center gap-4 text-sm"
              >
                <span className="inline-flex items-center gap-2 text-zinc-300">
                  <MapPin className="w-4 h-4 text-lime" aria-hidden />
                  Joypurhat, Bangladesh
                </span>
                <span className="w-px h-4 bg-white/10" aria-hidden />
                <span className="text-zinc-400">
                  Creative Developer · Full-Stack Engineer · AI Integrator
                </span>
              </motion.div>

              <motion.div
                initial="hidden"
                animate="show"
                variants={reveal}
                custom={4}
                className="mt-8 flex flex-wrap items-center gap-2"
              >
                {SOCIAL_ITEMS.map(({ key, label, icon: Icon, href }) => (
                  <a
                    key={key}
                    href={href}
                    target={href.startsWith("http") ? "_blank" : undefined}
                    rel={href.startsWith("http") ? "noreferrer" : undefined}
                    aria-label={label}
                    className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-full border border-white/10 bg-white/[0.03] text-sm text-zinc-200 hover:text-lime hover:border-lime/40 hover:bg-lime/5 transition-colors"
                  >
                    <Icon className="w-4 h-4" aria-hidden strokeWidth={1.8} />
                    <span>{label}</span>
                  </a>
                ))}
              </motion.div>
            </div>

            <motion.div
              initial="hidden"
              animate="show"
              variants={reveal}
              custom={2}
              className="relative"
            >
              <div className="relative aspect-[3/4] max-w-md mx-auto rounded-3xl overflow-hidden border border-white/[0.08] bg-ink-100">
                <picture>
                  <source
                    srcSet="/builder/delowar-portrait.webp"
                    type="image/webp"
                  />
                  <img
                    src="/builder/delowar-portrait.jpg"
                    alt="Portrait of Md Delowar Hossain"
                    width={800}
                    height={1066}
                    loading="eager"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </picture>
                <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-ink-100 via-ink-100/80 to-transparent">
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-400">
                    Photographed in Joypurhat
                  </div>
                  <div className="mt-1 font-display font-bold tracking-tight">
                    Md Delowar Hossain
                  </div>
                </div>
              </div>
              <div
                className="absolute -inset-4 -z-10 rounded-[28px] opacity-40 blur-2xl"
                style={{
                  background:
                    "radial-gradient(40% 40% at 50% 50%, rgba(195,244,0,0.25), transparent 70%)",
                }}
                aria-hidden
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Bio paragraphs ──────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-10 pb-12 max-w-shell mx-auto">
        <div className="grid md:grid-cols-3 gap-6">
          {BUILDER_BIO.map((p, i) => (
            <motion.article
              key={p.heading}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.4 }}
              variants={reveal}
              custom={i}
              className="rounded-2xl border border-white/[0.06] bg-ink-100/60 p-6"
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-lime mb-2">
                {String(i + 1).padStart(2, "0")} · {p.heading}
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed">{p.body}</p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* ── Timeline ────────────────────────────────────────── */}
      <section className="relative px-4 sm:px-6 lg:px-10 py-16 max-w-shell mx-auto">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
          / 03 — Milestones
        </div>
        <h2 className="mt-2 font-display font-bold tracking-tightest text-display-lg leading-[0.96]">
          Nine years of craft,
          <br />
          one product at a time.
        </h2>
        <ol className="mt-10 relative border-l border-white/[0.08] pl-6 sm:pl-8 space-y-8">
          {BUILDER_MILESTONES.map((m, i) => (
            <motion.li
              key={m.year}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.4 }}
              variants={reveal}
              custom={i}
              className="relative"
            >
              <span
                className="absolute -left-[33px] sm:-left-[37px] top-1.5 w-3 h-3 rounded-full bg-lime ring-4 ring-ink"
                aria-hidden
              />
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-lime">
                {m.year}
              </div>
              <h3 className="mt-1 font-display font-bold tracking-tight text-lg text-zinc-50">
                {m.title}
              </h3>
              <p className="mt-2 text-sm text-zinc-300 leading-relaxed max-w-2xl">
                {m.body}
              </p>
            </motion.li>
          ))}
        </ol>
      </section>

      {/* ── Awards ──────────────────────────────────────────── */}
      <section className="relative px-4 sm:px-6 lg:px-10 py-16 max-w-shell mx-auto">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
          / 04 — Recognition
        </div>
        <h2 className="mt-2 font-display font-bold tracking-tightest text-display-lg leading-[0.96]">
          Work that's been noticed
          <br />
          <span className="text-lime">by the right people.</span>
        </h2>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {BUILDER_AWARDS.map((award, i) => (
            <motion.div
              key={`${award.org}-${award.title}`}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.4 }}
              variants={reveal}
              custom={i}
              className="group relative rounded-2xl border border-white/[0.06] bg-ink-100/60 p-5 hover:border-lime/30 hover:bg-lime/[0.04] transition-colors"
            >
              <Award className="w-5 h-5 text-lime" aria-hidden />
              <div className="mt-3 font-display font-bold tracking-tight text-zinc-50 leading-snug">
                {award.title}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-400">
                {award.org} · {award.year}
              </div>
              <p className="mt-3 text-xs text-zinc-300 leading-relaxed">
                {award.body}
              </p>
            </motion.div>
          ))}
        </div>
        <p className="mt-6 text-[11px] font-mono uppercase tracking-[0.22em] text-zinc-500">
          Mentions sourced from delowarhossain.dev. Decade-spanning bodies of
          work: editorial design, immersive web, AI-native systems.
        </p>
      </section>

      {/* ── Final CTA ───────────────────────────────────────── */}
      <section className="relative px-4 sm:px-6 lg:px-10 py-20 max-w-shell mx-auto">
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-ink-100/70 p-8 sm:p-12">
          <div
            className="absolute inset-0 opacity-40 pointer-events-none"
            style={{
              background:
                "radial-gradient(60% 60% at 90% 10%, rgba(195,244,0,0.14), transparent 60%)",
            }}
            aria-hidden
          />
          <div className="relative grid lg:grid-cols-[1.4fr_1fr] gap-8 items-end">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                / 05 — Try it
              </div>
              <h2 className="mt-2 font-display font-bold tracking-tightest text-display-lg leading-[0.96]">
                {BRAND_TAGLINE}
              </h2>
              <p className="mt-4 max-w-xl text-zinc-300 leading-relaxed text-sm sm:text-base">
                Clean any email list — paste a few addresses, drop a CSV, or
                upload an Excel sheet with a million rows. Get back a tidy,
                verified file with every signal you need.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 lg:justify-end">
              <Link to="/signup" className="btn-primary text-sm">
                Get started free
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <a
                href={PORTFOLIO_URL}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost text-sm"
              >
                See more of Delowar's work
              </a>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

export default BuilderPage;
