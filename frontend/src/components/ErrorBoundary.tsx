/**
 * Error boundary, two flavours.
 *
 * 1. **Shell** (default) — full-screen recoverable fallback wrapped around
 *    the app so a top-level render crash doesn't blank the document.
 * 2. **Panel** — inline-card fallback meant for individual tabs / lazy
 *    routes. One panel crashing should not blank the entire UI; the
 *    boundary renders a recoverable card while the rest of the SPA stays
 *    mounted and the user can switch tabs.
 *
 * Pass ``panel`` to switch flavour. Pass ``resetKey`` to auto-clear the
 * error when the host re-keys (e.g. ``<RouteErrorBoundary resetKey={tab}>``
 * resets the boundary as soon as the user navigates to a different tab).
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** When true, render the small inline-card fallback instead of the
   *  full-screen one. Use for per-tab boundaries. */
  panel?: boolean;
  /** Optional human label for the failing region (shown in the fallback
   *  + console). */
  name?: string;
  /** When this prop changes, the boundary auto-resets and re-renders the
   *  children. Use ``key={tab}`` for the same effect; ``resetKey`` is
   *  there for cases where re-keying would unmount otherwise-stable
   *  state. */
  resetKey?: unknown;
  /** Override the fallback completely. Receives the error and a reset
   *  callback. */
  fallback?: (args: { error: Error; reset: () => void }) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset the boundary when the caller's resetKey flips (e.g. user
    // switched tabs). Without this, an error in tab A would persist when
    // the user navigated to tab B unless they clicked "Reload panel".
    if (
      this.state.error &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (typeof console !== "undefined") {
      const label = this.props.name ?? "panel";
      console.error(`[Email Verifier] uncaught render error in ${label}`, error, info);
    }
  }

  handleReset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback({ error, reset: this.handleReset });
    }

    if (this.props.panel) {
      return (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 space-y-3 text-rose-100">
          <div className="flex items-center gap-2 font-semibold text-rose-200">
            <AlertTriangle className="w-4 h-4" />
            {this.props.name ? `${this.props.name} crashed` : "This panel crashed"}
          </div>
          <p className="text-sm text-rose-100/80">
            The rest of the app is still healthy — switch tabs and come back,
            or click <em>Reload panel</em> below to retry. Your jobs and data
            are not lost.
          </p>
          <pre className="text-[11px] leading-snug text-rose-200/80 bg-black/30 rounded p-3 max-h-32 overflow-auto whitespace-pre-wrap">
            {error.message}
          </pre>
          <div className="flex gap-2">
            <button
              onClick={this.handleReset}
              className="rounded-lg bg-lime hover:bg-lime-300 text-ink text-sm font-semibold px-3 py-2"
            >
              Reload panel
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg border border-white/10 hover:bg-white/5 text-zinc-200 text-sm px-3 py-2"
            >
              Hard refresh
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-ink text-zinc-100">
        <div className="max-w-md surface-card border-rose-500/30 bg-rose-500/[0.06] p-7 space-y-4">
          <div className="flex items-center gap-2 font-display font-semibold text-rose-200 tracking-tight">
            <AlertTriangle className="w-5 h-5" aria-hidden /> Something broke in the UI
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">
            One panel crashed but the API and the rest of the app are still
            healthy. Try the action again — your jobs and data are not lost.
          </p>
          <pre className="text-[11px] leading-snug text-rose-200/80 bg-black/30 rounded-lg p-3 max-h-40 overflow-auto whitespace-pre-wrap font-mono">
            {error.message}
          </pre>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="btn-primary text-sm"
            >
              Reload panel
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-ghost-sm text-sm"
            >
              Hard refresh
            </button>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Per-tab error boundary. Wrap each lazy-loaded feature with this so a
 * crash inside (say) ``VerifyBulkTab`` shows a small inline card and
 * leaves the sidebar / topbar / footer fully usable. Auto-resets when the
 * caller passes a fresh ``resetKey`` (typically the active tab name).
 */
export function PanelErrorBoundary({
  name,
  resetKey,
  children,
}: {
  name: string;
  resetKey?: unknown;
  children: ReactNode;
}) {
  return (
    <ErrorBoundary panel name={name} resetKey={resetKey}>
      {children}
    </ErrorBoundary>
  );
}
