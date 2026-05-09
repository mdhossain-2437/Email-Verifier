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
  if (!ready) {
    return (
      <div className="relative min-h-screen flex items-center justify-center text-zinc-100">
        <div className="absolute inset-0 bg-grid pointer-events-none" />
        <div className="absolute inset-0 bg-glow pointer-events-none" />
        <div className="relative flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      </div>
    );
  }
  if (user) return <Navigate to="/app" replace />;
  return <LandingPage />;
}

/** Wraps a public route so signed-in users get bounced to /app. */
function PublicOnly({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) {
    return (
      <div className="relative min-h-screen flex items-center justify-center text-zinc-100">
        <div className="absolute inset-0 bg-grid pointer-events-none" />
        <div className="absolute inset-0 bg-glow pointer-events-none" />
        <div className="relative flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      </div>
    );
  }
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

  return (
    <ErrorBoundary>
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

          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-[1400px] w-full mx-auto">
            <Suspense fallback={<RouteFallback />}>
              <PanelErrorBoundary name={titles[tab].title} resetKey={tab}>
              {tab === "command-center" && (
                <CommandCenterView meta={meta} onNewJob={() => setTab("verify-bulk")} />
              )}
              {tab === "verify-bulk" && (
                <div className="space-y-6">
                  <PageHeader
                    title={titles[tab].title}
                    subtitle={titles[tab].subtitle}
                    cta={
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-soft" />
                        Engine ready
                      </span>
                    }
                  />
                  <VerifyBulkTab initialEmails={bulkSeed} meta={meta} />
                </div>
              )}
              {tab === "lead-finder" && <LeadFinderView />}
              {tab === "extract" && (
                <div className="space-y-6">
                  <PageHeader title={titles[tab].title} subtitle={titles[tab].subtitle} />
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
                  <PageHeader title={titles[tab].title} subtitle={titles[tab].subtitle} />
                  <VerifyOneTab />
                </div>
              )}
              {tab === "tools" && <ToolsMarketplaceView onGo={setTab} />}
              {tab === "keys" && (
                <div className="space-y-6">
                  <PageHeader title={titles[tab].title} subtitle={titles[tab].subtitle} />
                  <ApiKeysView />
                </div>
              )}
              {tab === "api" && (
                <div className="space-y-6">
                  <PageHeader title={titles[tab].title} subtitle={titles[tab].subtitle} />
                  <ApiTab />
                </div>
              )}
              {tab === "profile" && <ProfilePage />}
              {tab === "settings" && <SettingsPage />}
              {tab === "about" && (
                <div className="space-y-6">
                  <PageHeader title={titles[tab].title} subtitle={titles[tab].subtitle} />
                  <AboutTab meta={meta} />
                </div>
              )}
              </PanelErrorBoundary>
            </Suspense>
          </main>

          <footer className="border-t border-white/5 px-6 py-4 text-xs text-zinc-500 flex flex-wrap items-center justify-between gap-3">
            <div>
              Created by{" "}
              <a
                href={PORTFOLIO_URL}
                target="_blank"
                rel="noreferrer"
                className="text-zinc-300 hover:text-white"
              >
                Delowar Hossain
              </a>{" "}
              · MIT-spirited · bug reports and PRs welcome.
            </div>
            <div className="flex items-center gap-4">
              <a
                href={PORTFOLIO_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-zinc-300"
              >
                <Globe className="w-3 h-3" />
                Portfolio
              </a>
              <a
                href="https://github.com/mdhossain-2437"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-zinc-300"
              >
                <Github className="w-3 h-3" />
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
