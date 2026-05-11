/**
 * /changelog — public release notes timeline.
 *
 * We keep the entries authored in this file (instead of pulling live from
 * the GitHub Releases API) so the page renders instantly and works
 * offline / on the Vercel fallback. We export the list separately so it
 * can be referenced by tests.
 */

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, GitBranch, Github, Sparkles, Tag } from "lucide-react";

import { PublicLayout } from "@/components/landing/PublicLayout";
import { GITHUB_REPO } from "@/lib/uiTypes";
import { CHANGELOG, type ChangelogEntry } from "@/data/changelog";

const TAG_STYLES: Record<ChangelogEntry["tag"], string> = {
  stable: "border-lime/30 bg-lime/[0.08] text-lime-200",
  beta: "border-sky-500/30 bg-sky-500/[0.06] text-sky-200",
  patch: "border-zinc-500/30 bg-zinc-500/[0.04] text-zinc-300",
};

export function ChangelogPage() {
  useEffect(() => {
    document.title = "Changelog · Saaf";
  }, []);
  return (
    <PublicLayout>
      <section className="px-4 sm:px-6 lg:px-10 pt-16 sm:pt-24 pb-12 max-w-shell mx-auto">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 flex items-center gap-2">
          <GitBranch className="w-3.5 h-3.5 text-lime" aria-hidden />
          / changelog
        </div>
        <h1 className="mt-4 font-display font-bold text-display-xl tracking-tightest text-white max-w-4xl">
          Every release. <span className="text-lime">Every fix.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base sm:text-lg text-zinc-300 leading-relaxed">
          Selected highlights from the public Git history. For the full
          commit-level log, see GitHub.
        </p>
      </section>

      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-shell mx-auto">
        <ol className="relative space-y-12 border-l border-white/[0.08] pl-7 sm:pl-10">
          {CHANGELOG.map((entry) => (
            <li key={entry.version} className="relative">
              <span
                className="absolute -left-[37px] sm:-left-[49px] top-1 w-3 h-3 rounded-full bg-lime ring-4 ring-ink"
                aria-hidden
              />
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tighter">
                  v{entry.version}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.22em] ${TAG_STYLES[entry.tag]}`}
                >
                  <Tag className="w-3 h-3" aria-hidden />
                  {entry.tag}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                  {entry.date}
                </span>
              </div>
              <h3 className="mt-3 text-lg sm:text-xl font-semibold text-white">
                {entry.headline}
              </h3>
              <p className="mt-3 text-zinc-300 leading-relaxed max-w-3xl">
                {entry.body}
              </p>
              <ul className="mt-5 space-y-2">
                {entry.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-sm text-zinc-200">
                    <Sparkles className="w-3.5 h-3.5 text-lime mt-1 shrink-0" aria-hidden />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className="px-4 sm:px-6 lg:px-10 pb-20 max-w-shell mx-auto">
        <div className="rounded-3xl border border-lime/20 bg-gradient-to-br from-lime/[0.06] via-ink-100/0 to-transparent p-7 sm:p-12 text-center">
          <h2 className="font-display font-bold text-display-md tracking-tightest text-white">
            Want to be in a future release note?
          </h2>
          <p className="mt-3 text-zinc-300 max-w-xl mx-auto">
            Open a pull request. We credit every external contributor in the
            release notes.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noreferrer"
              className="btn-primary text-sm"
            >
              <Github className="w-4 h-4" aria-hidden /> View source
            </a>
            <Link to="/signup" className="btn-ghost text-sm">
              Try it free <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
