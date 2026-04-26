import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/lib/theme";

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

function RootRoute() {
  return (
    <ThemeProvider defaultTheme="light">
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
    </ThemeProvider>
  );
}

function RootShell({ children }: { children: React.ReactNode }) {
  // Inline pre-hydration script avoids a flash of light before the user's
  // saved theme is applied.
  const themeScript = `
    (function () {
      try {
        var stored = localStorage.getItem('praxis-theme');
        var theme = stored || 'light';
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else if (theme === 'system') {
          var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (prefersDark) document.documentElement.classList.add('dark');
        }
      } catch (e) {}
    })();
  `;
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
