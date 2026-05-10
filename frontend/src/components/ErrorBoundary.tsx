/**
 * Top-level error boundary for the app shell.
 *
 * One panel crashing should not blank the entire UI — the boundary renders a
 * recoverable fallback while the rest of the SPA stays mounted. This is
 * pulled out of App.tsx so the shell stays small and so route-level chunks
 * can wrap themselves in their own boundaries when it makes sense.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (typeof console !== "undefined") {
      console.error("[Email Verifier] uncaught render error", error, info);
    }
  }

  handleReset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
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
            {this.state.error.message}
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
