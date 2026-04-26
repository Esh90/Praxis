/**
 * Browser-side feedback ledger.
 *
 * Why this exists: the backend /feedback route requires Supabase to be
 * configured before it can persist anything, and many demo deploys run
 * without service-role credentials. Without this layer, a "thumbs
 * down + correction" submission disappears the moment the user
 * refreshes — which means the agents have nothing to learn from when
 * the user clicks "Regenerate this section".
 *
 * We mirror exactly the same shape the backend feedbackStore uses, so
 * future server-side persistence can pick up where this left off.
 *
 * Crash safety: every public function is wrapped so it can NEVER
 * throw. localStorage can throw in private-mode browsers, when the
 * quota is exceeded, or when a sandboxed iframe denies it. A throw
 * here used to propagate up through the feedback button click
 * handler and unmount the whole React root.
 */

export interface LocalFeedbackEntry {
  id: string;
  timestamp: number;
  section: "protocol" | "materials" | "budget" | "timeline" | "validation" | "general";
  rating: number;
  reason: string;
  correction: string;
  originalContent: string;
  domainUi?: string;
  experimentType?: string;
  hypothesis?: string;
  planId?: string | null;
}

const STORAGE_KEY = "praxis-feedback-v1";
const MAX_ENTRIES = 200;

function isBrowser(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function readAll(): LocalFeedbackEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(entries: LocalFeedbackEntry[]): void {
  if (!isBrowser()) return;
  try {
    const trimmed = entries.slice(-MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage might be full / disabled; fail soft.
  }
}

/**
 * Append an entry. Returns the saved entry, or `null` if the write
 * failed for any reason. NEVER throws.
 */
export function appendLocalFeedback(
  entry: Omit<LocalFeedbackEntry, "id" | "timestamp">,
): LocalFeedbackEntry | null {
  try {
    const full: LocalFeedbackEntry = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      ...entry,
    };
    const all = readAll();
    all.push(full);
    writeAll(all);
    return full;
  } catch (err) {
    // localStorage is unavailable / full / private mode — never crash UI.
    console.warn("[feedbackLocal] appendLocalFeedback failed:", err);
    return null;
  }
}

/**
 * Alias kept for forward-compatibility with the recovery plan that
 * uses `saveFeedbackLocally`. Both names point at the same writer
 * so existing call sites keep working.
 */
export const saveFeedbackLocally = appendLocalFeedback;

/**
 * Return up to `limit` most-recent feedback entries for a section,
 * newest first. Used when regenerating a section: we surface the user's
 * latest corrections so the LLM can apply them.
 */
export function getRecentFeedback(
  section: LocalFeedbackEntry["section"],
  limit = 5,
): LocalFeedbackEntry[] {
  try {
    const all = readAll();
    return all
      .filter(
        (e) => e.section === section && e.rating <= 3 && e.correction.trim().length > 0,
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Returns a one-line, human-readable summary of recent corrections for
 * the section, ready to be injected into a chat/regenerate prompt.
 * Empty string if there is no actionable feedback.
 */
export function buildRegenerationInstruction(
  section: LocalFeedbackEntry["section"],
): string {
  try {
    const recent = getRecentFeedback(section, 5);
    if (recent.length === 0) return "";

    const bullets = recent
      .map((c) => {
        const reason = c.reason ? `(${c.reason})` : "";
        return `- ${c.correction.trim()} ${reason}`.trim();
      })
      .join("\n");

    return [
      `The user has rated the previous ${section} section as poor and provided the following corrections.`,
      "Apply ALL of them in the regenerated output. Do not repeat the prior mistakes:",
      "",
      bullets,
    ].join("\n");
  } catch {
    return "";
  }
}

export function getAllFeedback(): LocalFeedbackEntry[] {
  return readAll();
}

export function clearLocalFeedback(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
