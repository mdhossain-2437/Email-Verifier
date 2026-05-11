/**
 * "Star + Contribute" section — live GitHub metrics and CTAs.
 *
 * Shows:
 *   - live star count + "Star on GitHub" button
 *   - fork + "Fork it" button
 *   - top contributor avatars
 *   - "Your first PR? We review within 48 h." invitation
 *   - link to "good first issue" label
 */

import { motion, type Variants } from "framer-motion";
import { GitFork, Github, Star, Users, ExternalLink } from "lucide-react";

import { formatCompact } from "@/lib/format";
import { useGitHubStats } from "@/lib/useGitHubStats";
import { GITHUB_REPO } from "@/lib/uiTypes";

const editorialEase: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
const reveal: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: editorialEase, delay: 0.06 * i },
  }),
};

function repoPath(): string {
  try {
    const url = new URL(GITHUB_REPO);
    return url.pathname.replace(/^\//, "");
  } catch {
    return "mdhossain-2437/Email-Verifier";
  }
}

export function ContributeStrip() {
  const gh = useGitHubStats({ repo: repoPath() });

  return (
    <section className="px-4 sm:px-6 lg:px-10 py-20 max-w-shell mx-auto border-t border-white/[0.05]">
      <div className="rounded-3xl border border-lime/20 bg-gradient-to-br from-lime/[0.04] via-ink-100/0 to-transparent p-7 sm:p-12 relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full bg-lime/10 blur-3xl"
          aria-hidden
        />

        <div className="relative">
          {/* heading */}
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 flex items-center gap-2">
            <span className="text-lime">/ open source</span>
            <span aria-hidden>—</span>
            <span>community</span>
          </div>
          <h2 className="mt-4 font-display font-bold text-display-md tracking-tightest text-white max-w-2xl">
            Built in the open. Shaped by contributors.
          </h2>
          <p className="mt-4 text-zinc-300 leading-relaxed max-w-xl">
            Every line of Saaf — backend, frontend, deploy configs — is MIT
            licensed on GitHub. Star it, fork it, send a PR.
          </p>

          {/* metrics row */}
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.5 }}
            variants={reveal}
            custom={0}
            className="mt-8 flex flex-wrap items-center gap-4"
          >
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/[0.06] backdrop-blur px-4 py-2 font-mono text-sm text-lime hover:bg-lime/[0.12] transition-colors min-h-[44px]"
            >
              <Star className="w-4 h-4" aria-hidden />
              Star{" "}
              {gh?.stars ? (
                <span className="tabular-nums font-bold">
                  {formatCompact(gh.stars) ?? gh.stars}
                </span>
              ) : null}
            </a>
            <a
              href={`${GITHUB_REPO}/fork`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 font-mono text-sm text-zinc-300 hover:text-lime hover:border-lime/30 transition-colors min-h-[44px]"
            >
              <GitFork className="w-4 h-4" aria-hidden />
              Fork{" "}
              {gh?.forks ? (
                <span className="tabular-nums font-bold">
                  {formatCompact(gh.forks) ?? gh.forks}
                </span>
              ) : null}
            </a>
            <a
              href={`${GITHUB_REPO}/issues?q=is:open+label:"good first issue"`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 font-mono text-sm text-zinc-300 hover:text-lime hover:border-lime/30 transition-colors min-h-[44px]"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden />
              Good first issues
            </a>
          </motion.div>

          {/* contributor avatars */}
          {gh?.topContributors && gh.topContributors.length > 0 && (
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.5 }}
              variants={reveal}
              custom={1}
              className="mt-8 flex items-center gap-4"
            >
              <div className="flex -space-x-2">
                {gh.topContributors.map((c) => (
                  <a
                    key={c.login}
                    href={c.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={`${c.login} — ${c.contributions} contributions`}
                    className="block w-9 h-9 rounded-full border-2 border-ink overflow-hidden hover:scale-110 transition-transform"
                  >
                    <img
                      src={c.avatar}
                      alt={c.login}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-400">
                <Users className="w-3.5 h-3.5 text-lime" aria-hidden />
                {gh.contributorsCount ?? gh.topContributors.length} contributors
              </div>
            </motion.div>
          )}

          {/* first-PR invitation */}
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.5 }}
            variants={reveal}
            custom={2}
            className="mt-8 flex items-start gap-3 rounded-xl border border-white/[0.06] bg-ink/40 p-4 max-w-lg"
          >
            <Github className="w-5 h-5 text-lime mt-0.5 shrink-0" aria-hidden />
            <div>
              <div className="text-sm font-medium text-zinc-100">
                First PR? We'll review it within 48 hours.
              </div>
              <div className="mt-1 text-xs text-zinc-400 leading-relaxed">
                Check the{" "}
                <a
                  href={`${GITHUB_REPO}/issues?q=is:open+label:"good first issue"`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-lime hover:underline"
                >
                  good first issues
                </a>{" "}
                for starter tasks, or open a new issue describing what you want to
                improve.
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
