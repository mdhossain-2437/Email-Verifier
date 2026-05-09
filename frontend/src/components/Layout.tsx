/**
 * App-shell layout primitives: Sidebar, Topbar, PageHeader.
 *
 * Pulled out of App.tsx so the route-level views can stay lazy-loaded
 * without dragging the chrome into every chunk. Pure presentation —
 * navigation state lives in App.tsx.
 */

import { useState, type ReactNode } from "react";
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
  Plus,
  Search,
  Settings2,
  Sparkles,
  Store,
  User as UserIcon,
  Users,
} from "lucide-react";

import {
  GITHUB_REPO,
  PORTFOLIO_URL,
  type Tab,
} from "@/lib/uiTypes";

interface NavItem {
  key: Tab;
  label: string;
  sublabel: string;
  icon: typeof Sparkles;
}

const NAV: NavItem[] = [
  { key: "command-center", label: "Dashboard", sublabel: "Command Center", icon: LayoutDashboard },
  { key: "verify-bulk", label: "Dataset", sublabel: "Mass Processing", icon: Database },
  { key: "lead-finder", label: "Lead Finder", sublabel: "Pattern Discovery", icon: Users },
  { key: "extract", label: "Extractor", sublabel: "Text & Files", icon: Sparkles },
  { key: "verify-one", label: "Inspector", sublabel: "Single Verify", icon: Filter },
  { key: "tools", label: "Marketplace", sublabel: "Utility Tools", icon: Store },
  { key: "keys", label: "API Keys", sublabel: "Personal Tokens", icon: KeyRound },
  { key: "api", label: "API", sublabel: "REST Reference", icon: Code2 },
  { key: "profile", label: "Profile", sublabel: "Account Identity", icon: UserIcon },
  { key: "settings", label: "Settings", sublabel: "Preferences", icon: Settings2 },
  { key: "about", label: "About", sublabel: "Credits & Limits", icon: Heart },
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
        className={`lg:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <aside
        className={`fixed lg:sticky top-0 z-40 h-screen w-64 shrink-0 border-r border-white/5 bg-[#080a12]/90 backdrop-blur-xl flex flex-col transition-transform ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="px-5 pt-6 pb-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 via-sky-400 to-emerald-400 grid place-items-center text-[#0b0d18] font-semibold text-sm shadow-lg">
                {user.initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white leading-tight truncate">
                {user.name}
              </div>
              <div className="text-[11px] text-indigo-300/80 leading-tight truncate">
                {user.email || "Signed in"}
              </div>
            </div>
            <button
              onClick={onSignOut}
              title="Sign out"
              aria-label="sign out"
              className="p-1.5 rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => window.open(GITHUB_REPO, "_blank")}
            className="mt-4 w-full rounded-lg bg-gradient-to-br from-indigo-500/90 to-sky-500/90 hover:from-indigo-400 hover:to-sky-400 transition-colors text-white text-sm font-medium py-2.5 shadow-lg shadow-indigo-500/20"
          >
            Upgrade to Pro
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
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
                className={`group w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  isActive
                    ? "bg-indigo-500/15 text-white border-l-2 border-indigo-400 pl-[10px]"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? "text-indigo-300" : "text-zinc-500 group-hover:text-zinc-300"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium leading-tight truncate">{item.label}</div>
                  <div className="text-[11px] text-zinc-500 leading-tight truncate">
                    {item.sublabel}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-white/5 space-y-1.5 text-xs">
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-zinc-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/5"
          >
            <Github className="w-3.5 h-3.5" />
            GitHub
          </a>
          <a
            href={PORTFOLIO_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-zinc-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/5"
          >
            <Globe className="w-3.5 h-3.5" />
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
    <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#080a12]/85 border-b border-white/5 px-4 sm:px-6 py-3 flex items-center gap-3">
      <button
        onClick={onMenu}
        className="lg:hidden p-2 rounded-lg text-zinc-400 hover:bg-white/5"
        aria-label="open menu"
      >
        <Filter className="w-4 h-4" />
      </button>
      <div className="font-semibold text-white tracking-tight whitespace-nowrap">
        <span className="text-indigo-300">Delowar&apos;s</span> Email Verifier
      </div>
      <div className="flex-1 hidden sm:flex justify-center px-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onJump(q);
            }}
            placeholder="Search jobs, emails, domains..."
            className="w-full rounded-full border border-white/5 bg-white/[0.03] pl-9 pr-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-400/40 focus:bg-white/[0.06]"
          />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-indigo-400/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-200 px-3 py-1.5 text-sm font-medium transition-colors"
          onClick={onNew}
        >
          <Plus className="w-3.5 h-3.5" />
          New Job
        </button>
        <button
          className="p-2 rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white"
          title="Notifications"
          aria-label="notifications"
        >
          <Bell className="w-4 h-4" />
        </button>
        <a
          href="/docs"
          target="_blank"
          rel="noreferrer"
          className="p-2 rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white"
          title="API docs"
          aria-label="docs"
        >
          <HelpCircle className="w-4 h-4" />
        </a>
        <button
          className="p-2 rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white"
          title="Settings"
          aria-label="settings"
        >
          <Settings2 className="w-4 h-4" />
        </button>
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.name}
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10 ml-1"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 via-sky-400 to-emerald-400 grid place-items-center text-[#0b0d18] font-semibold text-xs ml-1">
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
}: {
  title: string;
  subtitle: string;
  cta?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
      <div>
        <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">{title}</h1>
        <p className="mt-1.5 text-sm text-zinc-400 max-w-2xl">{subtitle}</p>
      </div>
      {cta && <div className="shrink-0">{cta}</div>}
    </div>
  );
}
