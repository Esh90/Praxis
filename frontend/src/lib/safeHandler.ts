/**
 * Crash-proof event-handler wrappers.
 *
 * The Praxis feedback widgets (thumbs up/down, flag dropdown,
 * correction panel) sit inside Radix UI portals. Portals render
 * into document.body but their *logical* React parent is wherever
 * the trigger is mounted — which means an uncaught exception from
 * inside a portal handler propagates UP past any ErrorBoundary that
 * is below the portal's logical parent. When that happens React
 * unmounts the entire root and the user sees the bare body
 * background (black in dark mode, off-white in light mode).
 *
 * Wrapping every handler that touches the Zustand store, the
 * network, or localStorage in `safeHandler` keeps any throw
 * contained so it can never tear down the React tree.
 */

import { toast } from "sonner";

type AnyArgs = unknown[];

/**
 * Wrap a sync OR async handler so any thrown error / rejected
 * promise is logged but never propagates to React's render cycle.
 *
 * Use on every Radix `onValueChange`, `onSelect`, dropdown item
 * `onClick`, and any chat/feedback button handler that calls into
 * the store or the network.
 */
export function safeHandler<TArgs extends AnyArgs>(
  fn: (...args: TArgs) => void | Promise<void>,
  fallback?: (error: unknown) => void,
): (...args: TArgs) => void {
  return (...args: TArgs) => {
    try {
      const result = fn(...args);
      if (result && typeof (result as Promise<void>).then === "function") {
        (result as Promise<void>).catch((error: unknown) => {
          console.error("[safeHandler] async handler error:", error);
          try {
            fallback?.(error);
          } catch (fallbackErr) {
            console.error("[safeHandler] fallback threw:", fallbackErr);
          }
        });
      }
    } catch (error) {
      console.error("[safeHandler] sync handler error:", error);
      try {
        fallback?.(error);
      } catch (fallbackErr) {
        console.error("[safeHandler] fallback threw:", fallbackErr);
      }
    }
  };
}

/**
 * Like `safeHandler` but for handlers that are guaranteed to be
 * async — surfaces a Sonner toast on failure instead of going
 * silent. Use for user-visible operations like "Submit correction".
 */
export function safeAsyncHandler<TArgs extends AnyArgs>(
  fn: (...args: TArgs) => Promise<void>,
  errorMessage = "Something went wrong",
): (...args: TArgs) => void {
  return (...args: TArgs) => {
    let promise: Promise<void>;
    try {
      promise = fn(...args);
    } catch (syncError) {
      console.error("[safeAsyncHandler] sync throw inside async fn:", syncError);
      tryToast(errorMessage, syncError);
      return;
    }
    promise.catch((error: unknown) => {
      console.error("[safeAsyncHandler] rejection:", error);
      tryToast(errorMessage, error);
    });
  };
}

function tryToast(title: string, err: unknown) {
  try {
    const detail =
      err instanceof Error
        ? err.message.slice(0, 120)
        : typeof err === "string"
          ? err.slice(0, 120)
          : undefined;
    toast.error(title, detail ? { description: detail } : undefined);
  } catch (toastErr) {
    // Toaster might not be mounted yet (early crash); never re-throw.
    console.warn("[safeAsyncHandler] toast unavailable:", toastErr);
  }
}
