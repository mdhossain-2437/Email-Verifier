/**
 * App-shell layout primitives: Sidebar, Topbar, PageHeader.
 *
 * Pulled out of App.tsx so the route-level views can stay lazy-loaded
 * without dragging the chrome into every chunk. Pure presentation —
 * navigation state lives in App.tsx.
 *
 * Visual language: sub-brand of delowarhossain.dev. Lime accent on
 * ink surfaces, Space Grotesk for display, monospace sub-labels.
 */

import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  Code2,
  Database,
  Filter,
  Github,
  Globe,
  HelpCircle,
  Heart,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Store,
  User as UserIcon,
  Users,
  X,
} from "lucide-react";

import {
  GITHUB_REPO,
  PORTFOLIO_URL,
  type Tab,
} from "@/lib/uiTypes";

interface NavItem {
  key: Tab;
  label: string;
  /** Monospace sub-label shown smaller; used for editorial caption styling. */
  sublabel: string;
  icon: typeof Sparkles;
}

const NAV: NavItem[] = [
  { key: "command-center", label: "Dashboard", sublabel: "command center", icon: LayoutDashboard },
  { key: "verify-bulk", label: "Dataset", sublabel: "mass processing", icon: Database },
  { key: "lead-finder", label: "Lead Finder", sublabel: "pattern discovery", icon: Users },
  { key: "extract", label: "Extractor", sublabel: "text & files", icon: Sparkles },
  { key: "verify-one", label: "Inspector", sublabel: "single verify", icon: Filter },
  { key: "tools", label: "Marketplace", sublabel: "utility tools", icon: Store },
  { key: "keys", label: "API Keys", sublabel: "personal tokens", icon: KeyRound },
  { key: "api", label: "API", sublabel: "rest reference", icon: Code2 },
  { key: "profile", label: "Profile", sublabel: "account identity", icon: UserIcon },
  { key: "settings", label: "Settings", sublabel: "preferences", icon: Settings2 },
  { key: "about", label: "About", sublabel: "credits & limits", icon: Heart },
];

export function Sidebar({
  active,
  onSelect,
  open,
  onClose,
  user,
  onSignOut,
}: {
  active: Tab;
  onSelect: (k: Tab) => void;
  open: boolean;
  onClose: () => void;
  user: { name: string; email: string | null; photoURL: string | null; initials: string };
  onSignOut: () => void;
}) {
  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={onClose}
        aria-hidden
        className={`lg:hidden fixed inset-0 z-30 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <aside
        aria-label="Primary navigation"
        className={`fixed lg:sticky top-0 z-40 h-screen w-72 shrink-0 border-r border-white/[0.06] bg-ink-100/95 backdrop-blur-xl flex flex-col transition-transform duration-300 ease-editorial ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Mobile close button */}
        <button
          onClick={onClose}
          aria-label="close navigation"
          className="lg:hidden absolute top-3 right-3 inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full text-zinc-400 hover:bg-white/[0.06] hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="px-5 pt-6 pb-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-full object-cover ring-1 ring-white/10"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-lime grid place-items-center text-ink font-display font-bold text-sm shadow-glow">
                {user.initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white leading-tight truncate">
                {user.name}
              </div>
              <div className="text-[11px] font-mono text-zinc-400 leading-tight truncate">
                {user.email || "signed in"}
              </div>
            </div>
            <button
              onClick={onSignOut}
              title="Sign out"
              aria-label="sign out"
              className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full text-zinc-400 hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <a
            href={PORTFOLIO_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-4 group flex items-center justify-between gap-2 rounded-2xl border border-lime/30 bg-lime/[0.08] hover:bg-lime/[0.14] hover:border-lime/50 transition-colors px-4 py-3 text-sm"
          >
            <span className="font-display font-semibold text-lime-200 tracking-tight">
              Portfolio
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-lime/70 group-hover:text-lime">
              delowar →
            </span>
          </a>
        </div>

        <nav
          className="flex-1 overflow-y-auto px-3 py-4 space-y-1"
          aria-label="Sections"
        >
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  onSelect(item.key);
                  onClose();
                }}
                aria-current={isActive ? "page" : undefined}
                className={`group w-full flex items-center gap-3 rounded-xl px-3 py-2.5 min-h-[44px] text-left transition-colors duration-150 ease-hover ${
                  isActive
                    ? "bg-lime/[0.10] text-white border-l-2 border-lime pl-[10px]"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? "text-lime" : "text-zinc-500 group-hover:text-zinc-300"
                  }`}
                  aria-hidden
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium leading-tight truncate">{item.label}</div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500 leading-tight truncate mt-0.5">
                    {item.sublabel}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-white/[0.06] space-y-1 text-xs">
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-zinc-400 hover:text-lime px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
          >
            <Github className="w-3.5 h-3.5" aria-hidden />
            GitHub
          </a>
          <a
            href={PORTFOLIO_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-zinc-400 hover:text-lime px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
          >
            <Globe className="w-3.5 h-3.5" aria-hidden />
            Portfolio
          </a>
        </div>
      </aside>
    </>
  );
}

export function Topbar({
  onMenu,
  onJump,
  onNew,
  user,
}: {
  onMenu: () => void;
  onJump: (q: string) => void;
  onNew: () => void;
  user: { name: string; photoURL: string | null; initials: string };
}) {
  const [q, setQ] = useState("");
  return (
    <header className="sticky top-0 z-20 backdrop-blur-xl bg-ink-100/85 border-b border-white/[0.06] px-3 sm:px-6 py-3 flex items-center gap-3">
      <button
        onClick={onMenu}
        className="lg:hidden inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full text-zinc-400 hover:bg-white/[0.06] hover:text-white"
        aria-label="open menu"
      >
        <Menu className="w-5 h-5" aria-hidden />
      </button>
      <Link
        to="/"
        className="font-display font-semibold text-white tracking-tight whitespace-nowrap text-sm sm:text-base inline-flex items-baseline gap-1.5 hover:opacity-90"
        aria-label="Saaf — home"
      >
        <span className="text-lime">saaf</span>
        <span aria-hidden className="hidden xs:inline text-[0.72em] text-zinc-500 font-medium">
          সাফ
        </span>
      </Link>
      <div className="flex-1 hidden md:flex justify-center px-4">
        <div className="relative w-full max-w-md">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none"
            aria-hidden
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onJump(q);
            }}
            placeholder="Jump to verify bulk…"
            aria-label="Quick search"
            className="w-full rounded-full border border-white/[0.07] bg-white/[0.03] pl-10 pr-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 transition-colors focus:border-lime/40 focus:bg-white/[0.05]"
          />
        </div>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <button
          className="hidden sm:inline-flex items-center gap-2 rounded-full bg-lime hover:bg-lime-300 text-ink font-semibold px-4 py-2 text-sm shadow-glow transition-colors min-h-[40px]"
          onClick={onNew}
        >
          <Plus className="w-4 h-4" aria-hidden />
          New job
        </button>
        <button
          className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full text-zinc-400 hover:bg-white/[0.06] hover:text-white transition-colors"
          title="Notifications"
          aria-label="notifications"
        >
          <Bell className="w-4 h-4" aria-hidden />
        </button>
        <a
          href="/docs"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full text-zinc-400 hover:bg-white/[0.06] hover:text-white transition-colors"
          title="API docs"
          aria-label="docs"
        >
          <HelpCircle className="w-4 h-4" aria-hidden />
        </a>
        <button
          className="hidden sm:inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full text-zinc-400 hover:bg-white/[0.06] hover:text-white transition-colors"
          title="Settings"
          aria-label="settings"
        >
          <Settings2 className="w-4 h-4" aria-hidden />
        </button>
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.name}
            referrerPolicy="no-referrer"
            className="w-9 h-9 rounded-full object-cover ring-1 ring-white/10 ml-1"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-lime grid place-items-center text-ink font-display font-bold text-xs ml-1">
            {user.initials}
          </div>
        )}
      </div>
    </header>
  );
}

export function PageHeader({
  title,
  subtitle,
  cta,
  eyebrow,
}: {
  title: string;
  subtitle: string;
  cta?: ReactNode;
  /** Monospace caption shown above the title (e.g. `/02 — VERIFY`). */
  eyebrow?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-6 sm:mb-8 animate-fade-in">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
        <h1 className="font-display text-display-md sm:text-display-lg font-bold text-white tracking-tighter">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 text-sm sm:text-base text-zinc-400 max-w-prose leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {cta && <div className="shrink-0">{cta}</div>}
    </div>
  );
}
