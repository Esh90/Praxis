import { useEffect } from "react";
import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/util/ErrorBoundary";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-[var(--bg-primary)]">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-7xl text-[var(--text-primary)]">404</h1>
        <h2 className="mt-4 text-xl font-medium">Page not found</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          This page is not in the experiment registry.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition"
          >
            Return home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Praxis — From hypothesis to runnable experiment" },
      { name: "description", content: "Describe your scientific hypothesis. Praxis runs the literature check, builds the protocol, sources the materials, and estimates the budget — in minutes." },
      { property: "og:title", content: "Praxis — Scientific thinking partner" },
      { property: "og:description", content: "From hypothesis to runnable experiment plan." },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href:
          "https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootRoute,
  notFoundComponent: NotFoundComponent,
});

/**
 * Install global window-level error shields.
 *
 * Why this matters: Radix UI portals (DropdownMenu, Select, Popover,
 * Dialog) render into document.body. When a handler inside one of
 * them throws synchronously OR rejects an unhandled promise, the
 * exception escapes the React fiber tree by way of the portal's
 * logical parent. In React 18/19 concurrent mode this can cascade
 * into a full root unmount — the user sees a black/white screen
 * because only the body background is left.
 *
 * Stopping these at the window level is the *last* line of defence
 * (every handler is also wrapped in `safeHandler`). Without it, a
 * single unhandled promise rejection from a feedback POST is enough
 * to wipe the UI on every demo.
 */
function useGlobalErrorShields() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    type Holder = { __lastPraxisError__?: unknown; __PRAXIS_DEBUG__?: boolean };
    const holder = window as unknown as Holder;
    holder.__PRAXIS_DEBUG__ = true;

    const onError = (event: ErrorEvent) => {
      console.error("[Praxis] uncaught global error:", event.error ?? event.message);
      holder.__lastPraxisError__ = {
        message: event.message,
        stack: event.error?.stack,
        timestamp: Date.now(),
      };
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      console.error("[Praxis] unhandled promise rejection:", event.reason);
      holder.__lastPraxisError__ = {
        message:
          event.reason instanceof Error
            ? event.reason.message
            : String(event.reason),
        stack: event.reason?.stack,
        timestamp: Date.now(),
      };
      // CRITICAL: prevent unhandled rejections from ever crashing React.
      event.preventDefault();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
}

function RootRoute() {
  useGlobalErrorShields();

  // We deliberately DO NOT wrap children in <ThemeProvider> any more.
  // That provider used to inject a theme state branch that differed
  // between SSR ("light") and the first client render (whatever the
  // user had stored), causing a hydration mismatch on every
  // theme-dependent attribute below it. The pre-hydration inline
  // script in <RootShell> is now the single source of truth: it sets
  // `<html class="dark">` before React mounts, and components read
  // that class directly when they need to be theme-aware.
  return (
    <ErrorBoundary>
      <Outlet />
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-subtle)",
            fontSize: "13px",
            borderRadius: "10px",
            boxShadow: "var(--shadow-lg)",
          },
        }}
      />
    </ErrorBoundary>
  );
}

function RootShell({ children }: { children: React.ReactNode }) {
  // Inline pre-hydration script. This MUST run before any React
  // bundle parses, otherwise React's hydration sees the server's
  // light-mode HTML and the user's saved dark-mode preference
  // disagree (which is exactly the crash we just fixed).
  //
  // The script sets `class="dark"` on `<html>` based on:
  //   1. `localStorage.praxis-theme` if explicitly set
  //   2. otherwise OS `prefers-color-scheme: dark`
  //   3. otherwise leaves it as light (no class added)
  const themeScript = `
    (function () {
      try {
        var stored = localStorage.getItem('praxis-theme');
        var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        var theme = (stored === 'dark' || stored === 'light')
          ? stored
          : (prefersDark ? 'dark' : 'light');
        if (theme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
      } catch (e) {}
    })();
  `;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      {/* suppressHydrationWarning on <body> tells React to silently
         patch any attribute differences (extensions like ColorZilla,
         Dark Reader, Grammarly inject inline styles into <body>
         after page load, and the pre-hydration theme class change
         can technically be observed here too). Without this flag,
         a single mismatched attribute forces a full subtree
         reconciliation that has historically unmounted the root. */}
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
