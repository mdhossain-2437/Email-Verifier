/**
 * Layout chrome shared by every public marketing page:
 *
 *   - Sticky translucent header with the brand mark, primary nav, and
 *     sign-in / sign-up CTAs.
 *   - Mobile menu drawer with the same nav links.
 *   - Footer with grouped link lists, status pill, and copyright.
 *
 * Pages render their content inside ``<PublicLayout>...</PublicLayout>``.
 */

import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  ArrowRight,
  Github,
  Menu,
  ShieldCheck,
  X as XIcon,
} from "lucide-react";

import { GITHUB_REPO, PORTFOLIO_URL } from "@/lib/uiTypes";

const NAV_LINKS: { label: string; to: string }[] = [
  { label: "Features", to: "/features" },
  { label: "Use cases", to: "/use-cases" },
  { label: "Pricing", to: "/pricing" },
  { label: "FAQ", to: "/faq" },
  { label: "Changelog", to: "/changelog" },
];

const FOOTER_GROUPS: { heading: string; links: { label: string; to?: string; href?: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "Features", to: "/features" },
      { label: "Use cases", to: "/use-cases" },
      { label: "Pricing", to: "/pricing" },
      { label: "Changelog", to: "/changelog" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "FAQ", to: "/faq" },
      { label: "API reference", href: "/docs" },
      { label: "GitHub", href: GITHUB_REPO },
      { label: "Open issue", href: `${GITHUB_REPO}/issues/new` },
    ],
  },
  {
    heading: "Build with us",
    links: [
      { label: "Get started", to: "/signup" },
      { label: "Sign in", to: "/login" },
      { label: "Portfolio", href: PORTFOLIO_URL },
    ],
  },
];

export function PublicLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="relative min-h-screen text-zinc-100 bg-ink overflow-x-hidden">
      <Header onOpen={() => setOpen(true)} />
      <MobileMenu open={open} onClose={() => setOpen(false)} />
      <main>{children}</main>
      <Footer />
    </div>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 group min-h-[44px]">
      <span className="w-9 h-9 rounded-2xl bg-lime grid place-items-center text-ink shadow-glow group-hover:scale-105 transition-transform">
        <ShieldCheck className="w-4.5 h-4.5" strokeWidth={2.4} />
      </span>
      <span className="font-display text-sm font-bold tracking-tight">
        <span className="text-lime">Delowar&apos;s</span> Email Verifier
      </span>
    </Link>
  );
}

function Header({ onOpen }: { onOpen: () => void }) {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-ink/70 border-b border-white/[0.04]">
      <div className="px-4 sm:px-6 lg:px-10 py-4 flex items-center justify-between gap-3 max-w-shell mx-auto">
        <Brand />
        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-7 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400"
        >
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `transition-colors hover:text-lime ${isActive ? "text-lime" : ""}`
              }
            >
              {link.label}
            </NavLink>
          ))}
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-lime transition-colors"
          >
            <Github className="w-3.5 h-3.5" aria-hidden /> GitHub
          </a>
        </nav>
        <div className="flex items-center gap-1.5">
          <Link
            to="/login"
            className="hidden sm:inline-flex items-center text-sm text-zinc-300 hover:text-white min-h-[44px] px-3 py-2 rounded-full transition-colors"
          >
            Sign in
          </Link>
          <Link to="/signup" className="btn-primary text-sm">
            Get started <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={onOpen}
            aria-label="Open menu"
            className="md:hidden inline-grid place-items-center w-11 h-11 rounded-lg border border-white/10 text-zinc-200"
          >
            <Menu className="w-5 h-5" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div
      className={`md:hidden fixed inset-0 z-50 transition-opacity ${
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        className={`absolute top-0 right-0 h-full w-[88%] max-w-sm bg-ink-100 border-l border-white/[0.06] p-6 flex flex-col gap-4 transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <Brand />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="inline-grid place-items-center w-11 h-11 rounded-lg border border-white/10 text-zinc-200"
          >
            <XIcon className="w-5 h-5" aria-hidden />
          </button>
        </div>
        <nav className="mt-2 flex flex-col gap-1" aria-label="Mobile">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `min-h-[44px] flex items-center font-display text-base font-medium px-1 transition-colors ${
                  isActive ? "text-lime" : "text-zinc-200 hover:text-lime"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noreferrer"
            className="min-h-[44px] flex items-center gap-2 font-display text-base font-medium px-1 text-zinc-200 hover:text-lime transition-colors"
          >
            <Github className="w-4 h-4" aria-hidden /> GitHub
          </a>
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <Link to="/signup" className="btn-primary text-sm w-full">
            Get started <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
          <Link to="/login" className="btn-ghost text-sm w-full">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.05] mt-24">
      <div className="px-4 sm:px-6 lg:px-10 py-12 max-w-shell mx-auto grid grid-cols-2 sm:grid-cols-4 gap-10">
        <div className="col-span-2 sm:col-span-1 space-y-4">
          <Brand />
          <p className="text-xs text-zinc-500 leading-relaxed max-w-xs">
            Clean email lists. Lower bounce rates. Self-host or run on the
            free tier. Open source under MIT.
          </p>
        </div>
        {FOOTER_GROUPS.map((group) => (
          <div key={group.heading} className="space-y-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              {group.heading}
            </div>
            <ul className="space-y-2">
              {group.links.map((l) => (
                <li key={l.label}>
                  {l.to ? (
                    <Link
                      to={l.to}
                      className="text-sm text-zinc-300 hover:text-lime transition-colors"
                    >
                      {l.label}
                    </Link>
                  ) : (
                    <a
                      href={l.href}
                      target={l.href?.startsWith("http") ? "_blank" : undefined}
                      rel={l.href?.startsWith("http") ? "noreferrer" : undefined}
                      className="text-sm text-zinc-300 hover:text-lime transition-colors"
                    >
                      {l.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="px-4 sm:px-6 lg:px-10 pb-10 max-w-shell mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="font-mono uppercase tracking-[0.18em] text-zinc-500">
          © {new Date().getFullYear()} Delowar Hossain · MIT License
        </div>
        <div className="font-mono uppercase tracking-[0.18em] text-zinc-500 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-lime pulse-soft" aria-hidden />
          all systems operational
        </div>
      </div>
    </footer>
  );
}
