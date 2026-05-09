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
      <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-[#0b0d18] text-zinc-100">
        <div className="max-w-md rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 space-y-4">
          <div className="flex items-center gap-2 text-rose-200 font-semibold">
            <AlertTriangle className="w-5 h-5" /> Something broke in the UI
          </div>
          <p className="text-sm text-zinc-300">
            One panel crashed but the API and the rest of the app are still
            healthy. Try the action again — your jobs and data are not lost.
          </p>
          <pre className="text-[11px] leading-snug text-rose-200/80 bg-black/30 rounded p-3 max-h-40 overflow-auto whitespace-pre-wrap">
            {this.state.error.message}
          </pre>
          <div className="flex gap-2">
            <button
              onClick={this.handleReset}
              className="rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium px-3 py-2"
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
      </div>
    );
  }
}
