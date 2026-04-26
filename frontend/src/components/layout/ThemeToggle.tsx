import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { safeHandler } from "@/lib/safeHandler";

type Theme = "dark" | "light";

const STORAGE_KEY = "praxis-theme";

/**
 * Hydration-safe theme toggle.
 *
 * Why the `theme === null` first render matters
 * ----------------------------------------------
 * The pre-hydration inline script in `__root.tsx` reads
 * `localStorage.praxis-theme` and adds `class="dark"` to `<html>`
 * BEFORE React mounts. That means the SSR HTML (which always assumes
 * "light") and the live DOM disagree the moment React tries to
 * hydrate.
 *
 * If this component renders ANY theme-dependent attribute on its
 * very first client render — e.g. `aria-label="Switch to light
 * mode"` vs the server's `aria-label="Switch to dark mode"` — React
 * 19 logs a hydration warning, then the next state update (clicking
 * any nearby control) forces a full reconciliation that re-throws
 * the deferred mismatch. On the prior hackathon build that throw
 * tore the React root down → black screen.
 *
 * The fix: this component renders an invisible placeholder with NO
 * theme-dependent attributes until `useEffect` runs (which only
 * happens on the client, after hydration is complete). At that
 * point we read the actual theme from the `<html>` class — which is
 * the source of truth — and re-render with the correct icon and
 * aria-label.
 */
function getInitialTheme(): Theme {
  try {
    if (typeof document !== "undefined") {
      if (document.documentElement.classList.contains("dark")) return "dark";
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "dark" || stored === "light") return stored;
      if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
    }
  } catch {
    // localStorage / matchMedia unavailable in some sandboxes.
  }
  return "light";
}

function applyTheme(next: Theme) {
  try {
    const root = document.documentElement;
    if (next === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage unavailable; the class change still works.
  }
}

export function ThemeToggle({ className }: { className?: string }) {
  // CRITICAL: start as null so the very first render (SSR + first
  // client render during hydration) is identical, regardless of the
  // user's saved theme. Only switch to the real theme after mount.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(getInitialTheme());
  }, []);

  const toggle = safeHandler(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  });

  // Pre-mount placeholder. `suppressHydrationWarning` tells React
  // that any text/attribute differences on this exact element are
  // expected and should be patched silently rather than re-thrown
  // when a later state update triggers reconciliation.
  if (theme === null) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        suppressHydrationWarning
        className={cn(
          "relative grid h-9 w-9 place-items-center rounded-md",
          "opacity-0 pointer-events-none",
          className,
        )}
        tabIndex={-1}
      />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "relative grid h-9 w-9 place-items-center rounded-md text-[var(--text-secondary)]",
        "hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] focus-ring",
        "transition-colors duration-150",
        className,
      )}
    >
      <Sun
        aria-hidden
        className={cn(
          "h-[18px] w-[18px] transition-all duration-300",
          isDark
            ? "rotate-90 scale-0 opacity-0"
            : "rotate-0 scale-100 opacity-100",
        )}
      />
      <Moon
        aria-hidden
        className={cn(
          "absolute h-[18px] w-[18px] transition-all duration-300",
          isDark
            ? "rotate-0 scale-100 opacity-100"
            : "-rotate-90 scale-0 opacity-0",
        )}
      />
    </button>
  );
}
