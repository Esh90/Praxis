import { useEffect, useState, useCallback, type ReactNode } from "react";

/**
 * Hydration-safe theme compat shim.
 *
 * Background: the previous implementation used a React Context whose
 * value differed between server (always "light") and the first
 * client render (whatever the user had stored / OS-preferred). On
 * React 19 + TanStack Start SSR, that's a textbook hydration
 * mismatch source — and any descendant rendering theme-dependent
 * attributes would later crash the entire root on the next state
 * update.
 *
 * The new approach:
 *
 *   1. The pre-hydration inline script in `__root.tsx` is the SINGLE
 *      source of truth for the user's theme during the first paint.
 *      It sets `<html class="dark">` (or leaves it off for light)
 *      before React mounts.
 *
 *   2. The `<ThemeProvider>` here is now a no-op fragment — kept only
 *      for backward compatibility with any imports that still expect
 *      it. It does NOT inject theme state into the SSR tree.
 *
 *   3. `useTheme()` returns "light" until after hydration, then
 *      reflects whatever class is on `<html>`. Components that need
 *      to render theme-dependent UI should use the same null-initial
 *      mounted-guard pattern as `ThemeToggle` (see that file's
 *      header comment).
 */

type Theme = "light" | "dark";

const STORAGE_KEY = "praxis-theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

/**
 * Now a passthrough fragment. Removing it from `__root.tsx`
 * eliminates the SSR theme-state branch that caused the hydration
 * mismatch. We keep this export so existing imports keep compiling.
 */
export function ThemeProvider({
  children,
}: {
  children: ReactNode;
  defaultTheme?: Theme;
}) {
  return <>{children}</>;
}

/**
 * Read-only theme hook. Always returns "light" during SSR and on
 * the first client render (matching SSR), then flips to the real
 * theme after mount. Mutations write through to `<html>` and to
 * localStorage.
 */
export function useTheme(): ThemeContextValue {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const real: Theme = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    setThemeState(real);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      const root = document.documentElement;
      if (t === "dark") root.classList.add("dark");
      else root.classList.remove("dark");
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // Storage / DOM unavailable; ignore silently.
    }
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      try {
        const root = document.documentElement;
        if (next === "dark") root.classList.add("dark");
        else root.classList.remove("dark");
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { theme, setTheme, toggle };
}
