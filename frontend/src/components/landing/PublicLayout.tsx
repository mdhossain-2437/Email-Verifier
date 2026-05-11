/**
 * Layout chrome shared by every public marketing page:
 *
 *   - Sticky translucent header with the Saaf brand mark, primary nav,
 *     and sign-in / sign-up CTAs.
 *   - Mobile menu drawer with the same nav links.
 *   - Footer with grouped link lists, a "Built by Delowar Hossain" card,
 *     social icons, status pill, and copyright.
 *
 * Pages render their content inside ``<PublicLayout>...</PublicLayout>``.
 */

import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  ArrowRight,
  AtSign,
  Github,
  Globe,
  Linkedin,
  Menu,
  Twitter,
  X as XIcon,
} from "lucide-react";

import { SaafLogo } from "@/components/brand/SaafLogo";
import {
  BRAND_BANGLA,
  BRAND_NAME,
  BRAND_TAGLINE,
  CONTACT_EMAIL,
  GITHUB_REPO,
  PORTFOLIO_URL,
  SOCIAL_LINKS,
} from "@/lib/brand";

const NAV_LINKS: { label: string; to: string }[] = [
  { label: "Features", to: "/features" },
  { label: "Use cases", to: "/use-cases" },
  { label: "Pricing", to: "/pricing" },
  { label: "FAQ", to: "/faq" },
  { label: "Builder", to: "/builder" },
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
      { label: "About the builder", to: "/builder" },
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

function Brand({ size = "header" }: { size?: "header" | "footer" }) {
  return (
    <Link
      to="/"
      className="flex items-center gap-2.5 group min-h-[44px]"
      aria-label={`${BRAND_NAME} — home`}
    >
      <SaafLogo
        variant="lockup"
        markClassName={
          size === "header" ? "w-9 h-9 group-hover:scale-105" : "w-10 h-10"
        }
        wordmarkClassName={size === "header" ? "text-sm" : "text-base"}
        inverted
      />
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

const SOCIAL_ITEMS: { key: keyof typeof SOCIAL_LINKS; label: string; icon: typeof Github }[] = [
  { key: "github", label: "GitHub", icon: Github },
  { key: "twitter", label: "X / Twitter", icon: Twitter },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin },
  { key: "email", label: "Email", icon: AtSign },
  { key: "portfolio", label: "Portfolio", icon: Globe },
];

function SocialIcons({ size = "md" }: { size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-9 h-9" : "w-10 h-10";
  const icon = size === "sm" ? "w-4 h-4" : "w-4.5 h-4.5";
  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Social links">
      {SOCIAL_ITEMS.filter(({ key }) => SOCIAL_LINKS[key]).map(({ key, label, icon: Icon }) => (
        <li key={key}>
          <a
            href={SOCIAL_LINKS[key]}
            target={SOCIAL_LINKS[key].startsWith("http") ? "_blank" : undefined}
            rel={SOCIAL_LINKS[key].startsWith("http") ? "noreferrer" : undefined}
            aria-label={label}
            title={label}
            className={`inline-grid place-items-center ${dim} rounded-full border border-white/10 bg-white/[0.03] text-zinc-300 hover:text-lime hover:border-lime/40 hover:bg-lime/5 transition-colors`}
          >
            <Icon className={icon} aria-hidden strokeWidth={1.8} />
          </a>
        </li>
      ))}
    </ul>
  );
}

function BuiltBy() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-ink-100/70 p-6 sm:p-8 mt-12">
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background:
            "radial-gradient(120% 80% at 100% 0%, rgba(195,244,0,0.10), transparent 60%)",
        }}
        aria-hidden
      />
      <div className="relative flex flex-col sm:flex-row gap-6 sm:items-center">
        <a
          href={PORTFOLIO_URL}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-2xl overflow-hidden ring-1 ring-white/10 hover:ring-lime/40 transition"
          aria-label="Visit Delowar Hossain's portfolio"
        >
          <picture>
            <source srcSet="/builder/delowar-avatar.webp" type="image/webp" />
            <img
              src="/builder/delowar-avatar.jpg"
              alt="Delowar Hossain"
              width={88}
              height={88}
              loading="lazy"
              decoding="async"
              className="w-22 h-22 sm:w-24 sm:h-24 object-cover"
              style={{ width: 88, height: 88 }}
            />
          </picture>
        </a>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="space-y-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
              Built by
            </div>
            <h3 className="font-display text-xl font-bold tracking-tight text-zinc-50">
              Md Delowar Hossain
              <span className="ml-2 text-sm font-medium text-zinc-500">
                · Creative Developer
              </span>
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed max-w-2xl">
              Saaf was designed and engineered solo by Delowar — a creative
              developer and full-stack engineer based in Joypurhat, Bangladesh.
              He ships editorial UIs, performance-first engineering, and
              AI-native systems where it counts. Saaf is built so smaller
              teams don't have to pay enterprise prices to clean an email list.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/builder"
              className="text-xs font-mono uppercase tracking-[0.18em] text-lime hover:underline inline-flex items-center gap-1"
            >
              Read the builder story
              <ArrowRight className="w-3 h-3" aria-hidden />
            </Link>
            <span className="w-px h-4 bg-white/10" aria-hidden />
            <SocialIcons size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.05] mt-24">
      <div className="px-4 sm:px-6 lg:px-10 py-12 max-w-shell mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-10">
          <div className="col-span-2 sm:col-span-1 space-y-4">
            <Brand size="footer" />
            <p className="text-xs text-zinc-400 leading-relaxed max-w-xs">
              {BRAND_BANGLA} — Bangla for "clean". {BRAND_TAGLINE} Open source
              under MIT. Self-host or run on the free tier.
            </p>
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-500">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="hover:text-lime transition-colors"
              >
                {CONTACT_EMAIL}
              </a>
            </div>
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
        <BuiltBy />
      </div>
      <div className="px-4 sm:px-6 lg:px-10 pb-10 max-w-shell mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="font-mono uppercase tracking-[0.18em] text-zinc-500">
          © {new Date().getFullYear()} Delowar Hossain · {BRAND_NAME.toUpperCase()} · MIT License
        </div>
        <div className="font-mono uppercase tracking-[0.18em] text-zinc-500 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-lime pulse-soft" aria-hidden />
          all systems operational
        </div>
      </div>
    </footer>
  );
}
