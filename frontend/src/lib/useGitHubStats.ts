/**
 * Live GitHub repo stats — stars, forks, watchers, open issues, contributors,
 * last commit time, latest contributor avatars — for the landing page
 * Contribute strip.
 *
 * Cached in localStorage for 5 minutes so we don't hammer the GitHub API
 * (which rate-limits unauthenticated requests at 60/hour/IP). On any
 * fetch failure we keep returning the cached payload, so the UI is
 * resilient to GitHub being down or the rate limit being hit.
 */

import { useEffect, useRef, useState } from "react";

export interface GitHubRepoStats {
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  lastPushedAt: string | null;
  contributorsCount: number | null;
  topContributors: Array<{
    login: string;
    avatar: string;
    htmlUrl: string;
    contributions: number;
  }>;
  fetchedAt: number;
}

interface Options {
  /** GitHub owner/repo path (e.g. ``"mdhossain-2437/Email-Verifier"``). */
  repo: string;
  /** Cache TTL in ms. Defaults to 5 minutes. */
  ttlMs?: number;
}

const CACHE_KEY = (repo: string) => `saaf:gh-stats:${repo}`;
const DEFAULT_TTL_MS = 5 * 60 * 1000;

function readCache(repo: string): GitHubRepoStats | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY(repo));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GitHubRepoStats;
    if (typeof parsed?.stars !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(repo: string, stats: GitHubRepoStats): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY(repo), JSON.stringify(stats));
  } catch {
    // localStorage full or unavailable — ignore.
  }
}

interface RawRepo {
  stargazers_count?: number;
  forks_count?: number;
  watchers_count?: number;
  subscribers_count?: number;
  open_issues_count?: number;
  pushed_at?: string;
}

interface RawContributor {
  login?: string;
  avatar_url?: string;
  html_url?: string;
  contributions?: number;
  type?: string;
}

async function fetchStats(repo: string): Promise<GitHubRepoStats> {
  const [repoResp, contributorsResp] = await Promise.all([
    fetch(`https://api.github.com/repos/${repo}`),
    fetch(`https://api.github.com/repos/${repo}/contributors?per_page=8`),
  ]);
  if (!repoResp.ok) {
    throw new Error(`GitHub repo: ${repoResp.status}`);
  }
  const repoBody = (await repoResp.json()) as RawRepo;

  let topContributors: GitHubRepoStats["topContributors"] = [];
  let contributorsCount: number | null = null;
  if (contributorsResp.ok) {
    const list = (await contributorsResp.json()) as RawContributor[];
    const humans = list.filter((c) => c.type !== "Bot");
    contributorsCount = humans.length;
    topContributors = humans
      .slice(0, 6)
      .map((c) => ({
        login: c.login ?? "",
        avatar: c.avatar_url ?? "",
        htmlUrl: c.html_url ?? "",
        contributions: c.contributions ?? 0,
      }))
      .filter((c) => c.login.length > 0);
  }

  return {
    stars: repoBody.stargazers_count ?? 0,
    forks: repoBody.forks_count ?? 0,
    watchers: repoBody.subscribers_count ?? repoBody.watchers_count ?? 0,
    openIssues: repoBody.open_issues_count ?? 0,
    lastPushedAt: repoBody.pushed_at ?? null,
    contributorsCount,
    topContributors,
    fetchedAt: Date.now(),
  };
}

export function useGitHubStats({
  repo,
  ttlMs = DEFAULT_TTL_MS,
}: Options): GitHubRepoStats | null {
  const [stats, setStats] = useState<GitHubRepoStats | null>(() =>
    readCache(repo),
  );
  const lastFetchRef = useRef<number>(stats?.fetchedAt ?? 0);

  useEffect(() => {
    let cancelled = false;

    async function maybeRefresh() {
      const cached = readCache(repo);
      const now = Date.now();
      const stale = !cached || now - cached.fetchedAt > ttlMs;
      if (cached && !cancelled) setStats(cached);
      if (!stale) return;
      try {
        const fresh = await fetchStats(repo);
        if (cancelled) return;
        writeCache(repo, fresh);
        lastFetchRef.current = fresh.fetchedAt;
        setStats(fresh);
      } catch {
        // Rate limited or offline. Keep showing cached/zeros — never throw.
      }
    }

    void maybeRefresh();
    return () => {
      cancelled = true;
    };
  }, [repo, ttlMs]);

  return stats;
}
