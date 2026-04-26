import type { PraxisPlan } from "@/lib/praxis-types";

function apiBase(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
  if (env?.VITE_PRAXIS_API_URL) return env.VITE_PRAXIS_API_URL;
  if (typeof window !== "undefined")
    return `${window.location.protocol}//${window.location.hostname}:3002`;
  return "http://localhost:3002";
}

function inferDomainFromHypothesis(text: string): string {
  const t = text.toLowerCase();
  if (/(crp|biosensor|elisa|electrochem|diagnostic|whole blood)/.test(t)) return "Diagnostics";
  if (/(gut|microbiome|fitc|tight junction|permeability|microbi|c57bl|lactobacill)/.test(t))
    return "Gut Health";
  if (/(co2|sporomusa|bioelectrochem|carbon|climate|emission|methane)/.test(t)) return "Climate";
  if (/(hela|cryopreserv|cell|trehalose|dmso|viability|cytometry)/.test(t)) return "Cell Biology";
  return "Gut Health";
}

export async function generatePlan(hypothesis: string, domainUi?: string): Promise<PraxisPlan> {
  const domain = domainUi ?? inferDomainFromHypothesis(hypothesis);
  let resp: Response;
  try {
    resp = await fetch(`${apiBase()}/api/praxis/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hypothesis, domain }),
    });
  } catch {
    throw new Error(
      `Couldn't reach the Praxis backend at ${apiBase()}. Make sure 'npm start' is running in the backend folder.`,
    );
  }
  const payload: unknown = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(humanizeError(payload, resp.status, "generate plan"));
  }
  return payload as PraxisPlan;
}

export interface ChatTurnResult {
  section: "protocol" | "materials" | "budget" | "timeline" | "validation" | null;
  // The shape depends on which section was updated; consumers cast.
  updated: unknown;
  summary?: string;
}

export async function sendChatTurn(input: {
  message: string;
  plan: PraxisPlan;
}): Promise<ChatTurnResult> {
  let resp: Response;
  try {
    resp = await fetch(`${apiBase()}/api/praxis/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: input.message,
        plan: input.plan,
      }),
    });
  } catch {
    throw new Error(
      `Couldn't reach the Praxis backend at ${apiBase()}. Make sure 'npm start' is running in the backend folder.`,
    );
  }
  const payload: unknown = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(humanizeError(payload, resp.status, "regenerate"));
  }
  return payload as ChatTurnResult;
}

function humanizeError(payload: unknown, status: number, action: string): string {
  const raw =
    payload && typeof payload === "object" && "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
      ? (payload as { error: string }).error
      : "";

  // All providers exhausted (every Groq model + every Gemini model failed).
  // This is the most common failure mode at the end of a heavy day.
  if (/all providers exhausted|exhausted all candidate/i.test(raw)) {
    return "Both LLM providers are at their daily limits. Wait ~30 min for the Groq token-per-day quota to roll, or add another GEMINI_API_KEY in agents/.env and restart the backend.";
  }

  // Specifically the Gemini-only 404 (deprecated model). Now rare since
  // groqClient.js rotates models, but kept for completeness.
  if (/gemini.*not\s+found|models\/gemini.*404|gemini.*model not found/i.test(raw)) {
    return "The configured Gemini model is unavailable. Set GEMINI_MODEL_CANDIDATES in agents/.env to a current model (e.g. gemini-2.0-flash) and restart the backend.";
  }

  if (/rate.?limit|429|tokens per day|TPD|quota/i.test(raw) || status === 429) {
    return "The primary LLM is rate-limited and the fallback couldn't take over. Wait for the Groq daily quota to reset, or add a working GEMINI_API_KEY in agents/.env.";
  }

  if (raw) return raw;

  if (status === 404) {
    return `Could not ${action}: backend route not found (HTTP 404). Confirm the backend is running and that VITE_PRAXIS_API_URL in frontend/.env points at the right port.`;
  }
  return `Could not ${action} (HTTP ${status}).`;
}

interface FeedbackBody {
  section: string;
  rating: number;
  reason: string;
  correction: string;
  originalContent: string;
  planId: string | null;
  domainUi: string;
  experimentType?: string;
}

function domainSlug(domainUi: string) {
  const map: Record<string, string> = {
    Diagnostics: "diagnostics",
    "Gut Health": "gut_health",
    "Cell Biology": "cell_biology",
    Climate: "climate",
  };
  return map[domainUi] ?? "other";
}

export async function submitFeedbackApi(b: FeedbackBody): Promise<{ id?: string }> {
  if (!b.planId) {
    // Without a planId the backend requires it; return a soft fail so the UI
    // can still acknowledge the user's input (we keep it client-side for the demo).
    return {};
  }
  const resp = await fetch(`${apiBase()}/api/praxis/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      plan_id: b.planId,
      section: b.section,
      rating: b.rating,
      original_content: b.originalContent,
      correction: b.correction,
      correction_reason: b.reason,
      experiment_type: b.experimentType ?? "",
      domain: domainSlug(b.domainUi),
    }),
  });
  const payload: unknown = await resp.json().catch(() => null);
  if (!resp.ok) {
    const msg =
      payload && typeof payload === "object" && "error" in payload &&
      typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : `HTTP ${resp.status}`;
    throw new Error(msg);
  }
  return (payload as { id?: string }) ?? {};
}
