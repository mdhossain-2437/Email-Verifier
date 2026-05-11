/**
 * Top-level SPA shell. Routing, auth gating, server-status banner, and tab
 * switching live here. The heavy feature views are pulled in via
 * ``React.lazy`` so each one ships as its own bundle chunk and a single
 * panel crash falls inside its own ``Suspense`` / ``ErrorBoundary``
 * boundary instead of blanking the whole UI.
 *
 * If you find yourself adding a new tab, the pattern is:
 *   1. Add the slug to ``TAB_TO_PATH`` in ``lib/uiTypes.ts``.
 *   2. Add a feature file under ``src/features/<your-tab>.tsx``.
 *   3. Add a ``React.lazy`` line below and a switch case in ``AppShell``.
 */

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Github, Globe, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import "./App.css";
import {
  api,
  setTokenGetter,
  startHealthProbe,
  type ServerMeta,
} from "@/lib/api";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { RequireAuth, FirebaseConfigGate } from "@/components/AuthGate";
import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { SettingsPage } from "@/pages/SettingsPage";
import { PricingPage } from "@/pages/public/PricingPage";
import { FeaturesPage } from "@/pages/public/FeaturesPage";
import { UseCasesPage } from "@/pages/public/UseCasesPage";
import { FaqPage } from "@/pages/public/FaqPage";
import { ChangelogPage } from "@/pages/public/ChangelogPage";
import { BuilderPage } from "@/pages/public/BuilderPage";
import { ErrorBoundary, PanelErrorBoundary } from "@/components/ErrorBoundary";
import { ServerStatusBanner } from "@/components/ServerStatusBanner";
import { RouteFallback } from "@/components/common";
import { PageHeader, Sidebar, Topbar } from "@/components/Layout";
import {
  PAGE_TITLES,
  PATH_TO_TAB,
  PORTFOLIO_URL,
  TAB_TO_PATH,
  type Tab,
} from "@/lib/uiTypes";

// ---------------------------------------------------------------------------
// Lazy-loaded route views. Each one becomes its own Vite bundle chunk so the
// initial paint doesn't have to download all 11 tabs' worth of code at once.
// ---------------------------------------------------------------------------
const CommandCenterView = lazy(() =>
  import("@/features/dashboard").then((m) => ({ default: m.CommandCenterView })),
);
const VerifyBulkTab = lazy(() =>
  import("@/features/verifyBulk").then((m) => ({ default: m.VerifyBulkTab })),
);
const LeadFinderView = lazy(() =>
  import("@/features/leadFinder").then((m) => ({ default: m.LeadFinderView })),
);
const ExtractTab = lazy(() =>
  import("@/features/extract").then((m) => ({ default: m.ExtractTab })),
);
const VerifyOneTab = lazy(() =>
  import("@/features/verifyOne").then((m) => ({ default: m.VerifyOneTab })),
);
const ToolsMarketplaceView = lazy(() =>
  import("@/features/tools").then((m) => ({ default: m.ToolsMarketplaceView })),
);
const ApiKeysView = lazy(() =>
  import("@/features/apiKeys").then((m) => ({ default: m.ApiKeysView })),
);
const ApiTab = lazy(() =>
  import("@/features/api").then((m) => ({ default: m.ApiTab })),
);
const AboutTab = lazy(() =>
  import("@/features/about").then((m) => ({ default: m.AboutTab })),
);

export default function App() {
  // Kick off the server-health probe loop once at app start. The api.ts
  // module-level state ensures it stays a singleton across re-renders.
  useEffect(() => {
    const stop = startHealthProbe();
    return () => stop();
  }, []);

  return (
    <AuthProvider>
      <FirebaseConfigGate>
        <BrowserRouter>
          <ServerStatusBanner />
          <Routes>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/use-cases" element={<UseCasesPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/changelog" element={<ChangelogPage />} />
            <Route path="/builder" element={<BuilderPage />} />
            <Route path="/about-builder" element={<Navigate to="/builder" replace />} />
            <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
            <Route path="/signup" element={<PublicOnly><SignupPage /></PublicOnly>} />
            <Route
              path="/app/*"
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </FirebaseConfigGate>
    </AuthProvider>
  );
}

/** Landing page for visitors; redirect to /app if already signed in. */
function HomeRoute() {
  const { user, ready } = useAuth();
  if (!ready) return <BrandLoading />;
  if (user) return <Navigate to="/app" replace />;
  return <LandingPage />;
}

/** Brand-aware loading splash. Used on auth-ready checks. */
function BrandLoading() {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-ink text-zinc-100">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="absolute inset-0 bg-glow pointer-events-none" />
      <div className="relative flex items-center gap-3 text-sm text-zinc-400">
        <Loader2 className="w-4 h-4 animate-spin text-lime" />
        <span className="font-mono uppercase tracking-[0.18em] text-[11px]">Loading…</span>
      </div>
    </div>
  );
}

/** Wraps a public route so signed-in users get bounced to /app. */
function PublicOnly({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <BrandLoading />;
  if (user) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function AppShell() {
  const { user, getIdToken, signOutUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [bulkSeed, setBulkSeed] = useState<string[]>([]);
  const [meta, setMeta] = useState<ServerMeta | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Translate URL path → internal tab. "/app" → command-center,
  // "/app/jobs" → verify-bulk, etc. Unknown sub-paths fall back to
  // command-center rather than 404'ing.
  const tab: Tab = useMemo(() => {
    const m = /^\/app\/?(.*)$/.exec(location.pathname);
    const slug = (m?.[1] || "").replace(/\/$/, "");
    return PATH_TO_TAB[slug] ?? "command-center";
  }, [location.pathname]);

  const setTab = useCallback(
    (next: Tab) => {
      const slug = TAB_TO_PATH[next];
      navigate(slug ? `/app/${slug}` : "/app");
    },
    [navigate],
  );

  useEffect(() => {
    setTokenGetter(() => getIdToken());
    return () => setTokenGetter(null);
  }, [getIdToken]);

  useEffect(() => {
    api.meta().then(setMeta).catch(() => undefined);
  }, []);

  useEffect(() => {
    document.title = PAGE_TITLES[tab];
  }, [tab]);

  const userInfo = useMemo(() => {
    const name = user?.displayName || user?.email?.split("@")[0] || "User";
    const initials = name
      .split(/\s+|[._-]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || "")
      .join("") || "U";
    return {
      name,
      email: user?.email ?? null,
      photoURL: user?.photoURL ?? null,
      initials,
    };
  }, [user]);

  const titles: Record<Tab, { title: string; subtitle: string }> = {
    "command-center": { title: "Command Center", subtitle: "" },
    "verify-bulk": {
      title: "Mass Processing Engine",
      subtitle:
        "Upload large lists for high-throughput validation and cleaning. CSV / XLSX / TXT / JSON / .mbox / .eml — the whole catalog from /api/meta is accepted.",
    },
    "lead-finder": { title: "Targeted Lead Finder", subtitle: "" },
    extract: {
      title: "Email Extractor",
      subtitle:
        "Paste any text or drop a file. We'll pull out every email, de-obfuscate '[at]' / '[dot]' patterns, and dedupe.",
    },
    "verify-one": {
      title: "Single Email Inspector",
      subtitle:
        "Drill into one address: syntax, MX records, country, role, disposable, and (optionally) live SMTP.",
    },
    tools: { title: "Tools Marketplace", subtitle: "" },
    keys: {
      title: "API Keys",
      subtitle:
        "Personal tokens for calling /api/* from your own code. Each key is shown ONCE at create time — store it somewhere safe immediately.",
    },
    api: {
      title: "REST API Reference",
      subtitle:
        "Call the same engine from your code. Swagger UI is available at /docs; quick examples below.",
    },
    profile: { title: "", subtitle: "" },
    settings: { title: "", subtitle: "" },
    about: { title: "About", subtitle: "" },
  };

  // Editorial eyebrow captions per tab — drives the monospace "/01 — …"
  // header glyphs that anchor the awwwards-style page reveals.
  const eyebrows: Partial<Record<Tab, string>> = {
    "verify-bulk": "/ 02 — Verify · bulk",
    "lead-finder": "/ 03 — Discover",
    extract: "/ 04 — Extract",
    "verify-one": "/ 05 — Inspect",
    keys: "/ 06 — Access",
    api: "/ 07 — Develop",
    about: "/ 08 — About",
  };

  return (
    <ErrorBoundary>
    <a href="#main" className="skip-link">Skip to content</a>
    <div className="relative min-h-screen text-zinc-100">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="absolute inset-0 bg-glow pointer-events-none" />

      <div className="relative flex">
        <Sidebar
          active={tab}
          onSelect={setTab}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          user={userInfo}
          onSignOut={() => {
            void signOutUser();
          }}
        />

        <div className="flex-1 min-w-0 flex flex-col min-h-screen">
          <Topbar
            onMenu={() => setSidebarOpen(true)}
            onJump={() => setTab("verify-bulk")}
            onNew={() => setTab("verify-bulk")}
            user={userInfo}
          />

          <main
            id="main"
            className="flex-1 px-4 sm:px-6 lg:px-10 py-6 sm:py-10 max-w-shell w-full mx-auto"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{
                  duration: 0.32,
                  ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number],
                }}
              >
            <Suspense fallback={<RouteFallback />}>
              <PanelErrorBoundary name={titles[tab].title} resetKey={tab}>
              {tab === "command-center" && (
                <CommandCenterView meta={meta} onNewJob={() => setTab("verify-bulk")} />
              )}
              {tab === "verify-bulk" && (
                <div className="space-y-6">
                  <PageHeader
                    eyebrow={eyebrows[tab]}
                    title={titles[tab].title}
                    subtitle={titles[tab].subtitle}
                    cta={
                      <span className="inline-flex items-center gap-2 rounded-full border border-lime/40 bg-lime/[0.08] px-3 py-1.5 text-xs font-mono text-lime-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-lime pulse-soft" />
                        ENGINE READY
                      </span>
                    }
                  />
                  <VerifyBulkTab initialEmails={bulkSeed} meta={meta} />
                </div>
              )}
              {tab === "lead-finder" && <LeadFinderView />}
              {tab === "extract" && (
                <div className="space-y-6">
                  <PageHeader eyebrow={eyebrows[tab]} title={titles[tab].title} subtitle={titles[tab].subtitle} />
                  <ExtractTab
                    meta={meta}
                    onResults={(emails) => {
                      setBulkSeed(emails);
                      setTab("verify-bulk");
                    }}
                  />
                </div>
              )}
              {tab === "verify-one" && (
                <div className="space-y-6">
                  <PageHeader eyebrow={eyebrows[tab]} title={titles[tab].title} subtitle={titles[tab].subtitle} />
                  <VerifyOneTab />
                </div>
              )}
              {tab === "tools" && <ToolsMarketplaceView onGo={setTab} />}
              {tab === "keys" && (
                <div className="space-y-6">
                  <PageHeader eyebrow={eyebrows[tab]} title={titles[tab].title} subtitle={titles[tab].subtitle} />
                  <ApiKeysView />
                </div>
              )}
              {tab === "api" && (
                <div className="space-y-6">
                  <PageHeader eyebrow={eyebrows[tab]} title={titles[tab].title} subtitle={titles[tab].subtitle} />
                  <ApiTab />
                </div>
              )}
              {tab === "profile" && <ProfilePage />}
              {tab === "settings" && <SettingsPage />}
              {tab === "about" && (
                <div className="space-y-6">
                  <PageHeader eyebrow={eyebrows[tab]} title={titles[tab].title} subtitle={titles[tab].subtitle} />
                  <AboutTab meta={meta} />
                </div>
              )}
              </PanelErrorBoundary>
            </Suspense>
              </motion.div>
            </AnimatePresence>
          </main>

          <footer className="border-t border-white/[0.05] px-4 sm:px-6 py-6 text-xs text-zinc-500 flex flex-wrap items-center justify-between gap-3">
            <div className="font-mono uppercase tracking-[0.16em] text-[10px]">
              Created by{" "}
              <a
                href={PORTFOLIO_URL}
                target="_blank"
                rel="noreferrer"
                className="text-lime hover:text-lime-300 transition-colors"
              >
                Delowar Hossain
              </a>{" "}
              · MIT licensed · bug reports & PRs welcome.
            </div>
            <div className="flex items-center gap-4">
              <a
                href={PORTFOLIO_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-lime transition-colors"
              >
                <Globe className="w-3 h-3" aria-hidden />
                Portfolio
              </a>
              <a
                href="https://github.com/mdhossain-2437/Email-Verifier"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-lime transition-colors"
              >
                <Github className="w-3 h-3" aria-hidden />
                GitHub
              </a>
            </div>
          </footer>
        </div>
      </div>
    </div>
    </ErrorBoundary>
  );
}
