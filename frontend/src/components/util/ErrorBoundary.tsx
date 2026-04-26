import React from "react";

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface Props {
  children: React.ReactNode;
}

/**
 * Catches uncaught render-time errors so the entire Praxis UI cannot
 * vanish from a runtime exception (e.g. a feedback submission, a
 * Radix portal handler that throws, a transient render error).
 *
 * Implementation notes:
 *
 * 1. The fallback uses INLINE STYLES — not Tailwind classes, not CSS
 *    variables. Because the most common cause of a visible blackout
 *    is the React root being torn down, we cannot rely on the
 *    `--bg-*` design tokens having been applied to anything React
 *    rendered. Inline styles are guaranteed to paint regardless of
 *    what state the rest of the app is in.
 *
 * 2. The fallback resolves its theme from `<html class="dark">` so
 *    the recovery screen matches the user's current mode. If the
 *    inline pre-hydration script in `__root.tsx` ran (it always does),
 *    this class is set before this component ever renders.
 *
 * 3. Position this boundary as the OUTERMOST wrapper inside
 *    `RootRoute` — above the `ThemeProvider` and the `Toaster` —
 *    so it can catch errors that originate inside those providers
 *    or inside Radix portals whose logical parent is the route root.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] caught error:", error);
    console.error("[ErrorBoundary] component stack:", info.componentStack);
    this.setState({ errorInfo: info });
    if (typeof window !== "undefined") {
      (window as unknown as { __lastPraxisError__?: unknown }).__lastPraxisError__ = {
        message: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
        timestamp: Date.now(),
      };
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  refresh = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isDark =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark");

    const palette = isDark
      ? {
          bg: "#0C0C0B",
          surface: "#1A1917",
          border: "#2A2826",
          text: "#FAFAF9",
          textMuted: "#A8A29E",
          errorTint: "#3F1D1D",
          errorBorder: "#7F1D1D",
          accent: "#6366F1",
          accentHover: "#4F46E5",
        }
      : {
          bg: "#FAFAF9",
          surface: "#FFFFFF",
          border: "#E8E6E3",
          text: "#1A1917",
          textMuted: "#57534E",
          errorTint: "#FEF2F2",
          errorBorder: "#FECACA",
          accent: "#4F46E5",
          accentHover: "#4338CA",
        };

    const message = this.state.error?.message ?? "An unexpected error occurred.";
    const isDev =
      typeof import.meta !== "undefined" &&
      typeof (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV ===
        "boolean"
        ? Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV)
        : false;

    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          width: "100%",
          background: palette.bg,
          color: palette.text,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            maxWidth: "480px",
            width: "100%",
            background: palette.surface,
            border: `1px solid ${palette.border}`,
            borderRadius: "16px",
            padding: "32px",
            boxShadow: isDark
              ? "0 8px 24px rgba(0,0,0,0.4)"
              : "0 4px 6px -1px rgba(0,0,0,0.07)",
          }}
        >
          <div
            aria-hidden
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: palette.errorTint,
              border: `1px solid ${palette.errorBorder}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
              fontSize: "20px",
              color: "#DC2626",
              fontWeight: 700,
            }}
          >
            !
          </div>
          <h2
            style={{
              margin: "0 0 8px",
              fontSize: "18px",
              fontWeight: 600,
              color: palette.text,
            }}
          >
            Praxis ran into a problem
          </h2>
          <p
            style={{
              margin: "0 0 24px",
              fontSize: "14px",
              color: palette.textMuted,
              lineHeight: 1.6,
            }}
          >
            Your hypothesis and plan are still preserved in this tab. Click
            "Try again" to continue, or refresh if it doesn't recover.
          </p>

          {isDev && this.state.error && (
            <pre
              style={{
                background: palette.errorTint,
                border: `1px solid ${palette.errorBorder}`,
                borderRadius: "8px",
                padding: "12px",
                fontSize: "11px",
                color: "#DC2626",
                overflow: "auto",
                marginBottom: "16px",
                maxHeight: "180px",
                whiteSpace: "pre-wrap",
                fontFamily:
                  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            >
              {message}
              {this.state.errorInfo?.componentStack
                ? `\n\n${this.state.errorInfo.componentStack.slice(0, 800)}`
                : ""}
            </pre>
          )}

          <button
            type="button"
            onClick={this.reset}
            style={{
              width: "100%",
              padding: "10px",
              background: palette.accent,
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "background 150ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                palette.accentHover;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = palette.accent;
            }}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={this.refresh}
            style={{
              width: "100%",
              padding: "10px",
              marginTop: "8px",
              background: "transparent",
              color: palette.textMuted,
              border: `1px solid ${palette.border}`,
              borderRadius: "8px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Refresh page
          </button>
        </div>
      </div>
    );
  }
}
