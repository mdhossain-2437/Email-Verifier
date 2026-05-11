/**
 * UI-layer types and constants shared across feature views.
 *
 * Anything in here is pure data / type — no React, no DOM, no API calls. The
 * /features and /components trees both import from this module.
 */

import { CheckCircle2, HelpCircle, ShieldAlert, XCircle } from "lucide-react";
import type { Status, VerifyResult } from "./api";

export type Tab =
  | "command-center"
  | "verify-bulk"
  | "lead-finder"
  | "extract"
  | "verify-one"
  | "tools"
  | "api"
  | "keys"
  | "profile"
  | "settings"
  | "about";

/**
 * Mapping between URL slugs (under /app) and the internal Tab union. The
 * router translates route changes into tab changes via these tables.
 */
export const TAB_TO_PATH: Record<Tab, string> = {
  "command-center": "",
  "verify-bulk": "jobs",
  "lead-finder": "leads",
  extract: "extract",
  "verify-one": "inspector",
  tools: "tools",
  keys: "keys",
  api: "api",
  profile: "profile",
  settings: "settings",
  about: "about",
};

export const PATH_TO_TAB: Record<string, Tab> = Object.fromEntries(
  Object.entries(TAB_TO_PATH).map(([k, v]) => [v, k as Tab]),
) as Record<string, Tab>;

export const PAGE_TITLES: Record<Tab, string> = {
  "command-center": "Dashboard · Saaf",
  "verify-bulk": "Bulk verify · Saaf",
  "lead-finder": "Find work emails · Saaf",
  extract: "Extract emails · Saaf",
  "verify-one": "Single inspector · Saaf",
  tools: "All tools · Saaf",
  keys: "API keys · Saaf",
  api: "REST API · Saaf",
  profile: "Profile · Saaf",
  settings: "Settings · Saaf",
  about: "About Saaf",
};

export const STATUS_META: Record<
  Status,
  { label: string; cls: string; icon: typeof CheckCircle2 }
> = {
  valid: {
    label: "Valid",
    cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    icon: CheckCircle2,
  },
  invalid: {
    label: "Invalid",
    cls: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    icon: XCircle,
  },
  risky: {
    label: "Risky",
    cls: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    icon: ShieldAlert,
  },
  unknown: {
    label: "Unknown",
    cls: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
    icon: HelpCircle,
  },
};

// Brand & social constants moved to ./brand.ts; re-exported here for
// backward compatibility so existing imports keep working unchanged.
export {
  BRAND_NAME,
  BRAND_BANGLA,
  BRAND_DOMAIN,
  BRAND_URL,
  BRAND_TAGLINE,
  BRAND_DESCRIPTION,
  BRAND_DESCRIPTION_SHORT,
  PORTFOLIO_URL,
  FOLIO_URL,
  GITHUB_PROFILE,
  GITHUB_REPO,
  CONTACT_EMAIL,
  SOCIAL_LINKS,
} from "./brand";

export const SAMPLE_TEXT = `Hello team - please reach out to sales@github.com for partnership inquiries
and to support@github.com for help. Marketing reports go to ada [at] example
[dot] com, and our incident channel is incidents+pager@example.org.

Bogus addresses we should reject: not-an-email, foo@bar, bob@invalid-domain-xyz.test,
admin@nonexistent-company-abc-12345.com.`;

export interface BulkFilters {
  status: Status | "all";
  role: "any" | "yes" | "no";
  disposable: "any" | "yes" | "no";
  mx: "any" | "yes" | "no";
  mailbox: "any" | "free" | "work";
  country: string; // "all" or country code
  query: string;
}

export const DEFAULT_FILTERS: BulkFilters = {
  status: "all",
  role: "any",
  disposable: "any",
  mx: "any",
  mailbox: "any",
  country: "all",
  query: "",
};

export function applyFilters(
  rows: VerifyResult[],
  f: BulkFilters,
): VerifyResult[] {
  const q = f.query.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.status !== "all" && r.status !== f.status) return false;
    if (f.role === "yes" && !r.is_role) return false;
    if (f.role === "no" && r.is_role) return false;
    if (f.disposable === "yes" && !r.is_disposable) return false;
    if (f.disposable === "no" && r.is_disposable) return false;
    if (f.mx === "yes" && r.has_mx !== true) return false;
    if (f.mx === "no" && r.has_mx === true) return false;
    if (f.mailbox === "free" && !r.is_free_provider) return false;
    if (f.mailbox === "work" && r.is_free_provider) return false;
    if (f.country !== "all" && (r.country_code ?? "") !== f.country)
      return false;
    if (q) {
      const hay = [
        r.email,
        r.normalized ?? "",
        r.domain ?? "",
        r.reason ?? "",
        r.provider ?? "",
        r.country_name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
