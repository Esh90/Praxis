import { create } from "zustand";
import type { PraxisPlan } from "@/lib/praxis-types";
import { generatePlan, sendChatTurn, submitFeedbackApi } from "@/lib/api";

export type PipelineStatus =
  | "idle"
  | "qc"
  | "awaiting_generate"
  | "generating"
  | "complete"
  | "regenerating"
  | "error";

export type CanvasTab = "protocol" | "materials" | "budget" | "timeline" | "validation";

export interface CompletedStep {
  id: string;
  label: string;
  detail?: string;
  durationMs: number;
  status: "done" | "running" | "pending";
}

export type MessageType =
  | "user"
  | "status"
  | "novelty"
  | "generate_cta"
  | "assistant"
  | "system_error"
  | "regen_status";

export interface ChatMessage {
  id: string;
  type: MessageType;
  content?: string;
  timestamp: number;
  meta?: Record<string, unknown>;
}

export interface FeedbackPayload {
  section: CanvasTab | "general";
  rating: number;
  reason: string;
  correction: string;
  originalContent: string;
  messageId?: string;
  experimentType?: string;
}

interface PraxisState {
  sessionId: string;
  isActive: boolean;

  pipelineStatus: PipelineStatus;
  currentStep: string;
  completedSteps: CompletedStep[];
  pipelineStartTime: number | null;
  pipelineError: string | null;

  hypothesis: string;
  /** Domain explicitly chosen by the user on the landing screen. Falls back to
   * heuristic inference when the user doesn't pick one. */
  selectedDomain: string | null;
  plan: PraxisPlan | null;
  populatedTabs: Set<CanvasTab>;
  recentlyUpdatedTabs: Set<CanvasTab>;
  previousPlanSnapshot: PraxisPlan | null;

  activeTab: CanvasTab;
  showQCResult: boolean;
  showGenerateCTA: boolean;

  messages: ChatMessage[];
  inputValue: string;

  setInputValue: (v: string) => void;
  setSelectedDomain: (d: string | null) => void;
  setActiveTab: (tab: CanvasTab) => void;
  reset: () => void;
  addMessage: (msg: Omit<ChatMessage, "id" | "timestamp"> & { id?: string }) => string;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  removeMessage: (id: string) => void;
  setStep: (label: string) => void;
  pushCompletedStep: (step: Omit<CompletedStep, "durationMs"> & { durationMs?: number }) => void;
  clearStatus: () => void;

  submitHypothesis: (hypothesis: string, domain?: string | null) => Promise<void>;
  generatePlan: () => Promise<void>;
  submitFollowUp: (text: string) => Promise<void>;
  submitFeedback: (payload: FeedbackPayload) => Promise<void>;
  regenerateSection: (section: CanvasTab) => Promise<void>;
  dismissDiff: (section: CanvasTab) => void;
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const STEP_SEQUENCE_QC: { id: string; label: string; minMs: number }[] = [
  { id: "parse", label: "Analyzing hypothesis...", minMs: 700 },
  { id: "search", label: "Searching PubMed & arXiv...", minMs: 1000 },
  { id: "classify", label: "Classifying novelty...", minMs: 600 },
];

const STEP_SEQUENCE_GEN: { id: string; label: string; minMs: number; tab?: CanvasTab }[] = [
  { id: "protocol", label: "Generating protocol...", minMs: 1100, tab: "protocol" },
  { id: "materials", label: "Sourcing materials & catalog numbers...", minMs: 1100, tab: "materials" },
  { id: "budget", label: "Calculating budget & timeline...", minMs: 900, tab: "budget" },
  { id: "validation", label: "Building validation approach...", minMs: 800, tab: "validation" },
  { id: "finalize", label: "Finalizing plan...", minMs: 400 },
];

async function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export const usePraxisStore = create<PraxisState>((set, get) => ({
  sessionId: uid(),
  isActive: false,

  pipelineStatus: "idle",
  currentStep: "",
  completedSteps: [],
  pipelineStartTime: null,
  pipelineError: null,

  hypothesis: "",
  selectedDomain: null,
  plan: null,
  populatedTabs: new Set<CanvasTab>(),
  recentlyUpdatedTabs: new Set<CanvasTab>(),
  previousPlanSnapshot: null,

  activeTab: "protocol",
  showQCResult: false,
  showGenerateCTA: false,

  messages: [],
  inputValue: "",

  setInputValue: (v) => set({ inputValue: v }),
  setSelectedDomain: (d) => set({ selectedDomain: d }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  reset: () =>
    set({
      sessionId: uid(),
      isActive: false,
      pipelineStatus: "idle",
      currentStep: "",
      completedSteps: [],
      pipelineStartTime: null,
      pipelineError: null,
      hypothesis: "",
      selectedDomain: null,
      plan: null,
      populatedTabs: new Set<CanvasTab>(),
      recentlyUpdatedTabs: new Set<CanvasTab>(),
      previousPlanSnapshot: null,
      activeTab: "protocol",
      showQCResult: false,
      showGenerateCTA: false,
      messages: [],
      inputValue: "",
    }),

  addMessage: (msg) => {
    const id = msg.id ?? uid();
    set((state) => ({
      messages: [...state.messages, { id, timestamp: Date.now(), ...msg } as ChatMessage],
    }));
    return id;
  },
  updateMessage: (id, patch) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),
  removeMessage: (id) =>
    set((state) => ({ messages: state.messages.filter((m) => m.id !== id) })),

  setStep: (label) => set({ currentStep: label }),
  pushCompletedStep: (step) =>
    set((state) => ({
      completedSteps: [
        ...state.completedSteps,
        { durationMs: step.durationMs ?? 0, ...step } as CompletedStep,
      ],
    })),
  clearStatus: () => set({ completedSteps: [], currentStep: "" }),

  // ─────────────────────────────────────────────────────────────────
  // Phase 1: User submits hypothesis → activate split, run QC stages
  // The backend currently runs the full pipeline in one shot, so we
  // request it once and then stage UI reveals to feel like a real
  // multi-stage agent run. The plan stays hidden until user clicks
  // "Generate Experiment Plan".
  // ─────────────────────────────────────────────────────────────────
  submitHypothesis: async (hypothesis: string, domain?: string | null) => {
    if (!hypothesis.trim()) return;

    const userMsgId = uid();
    const statusMsgId = uid();
    const domainOverride = domain ?? get().selectedDomain;

    set((state) => ({
      hypothesis,
      selectedDomain: domainOverride ?? state.selectedDomain,
      isActive: true,
      pipelineStatus: "qc",
      pipelineStartTime: Date.now(),
      pipelineError: null,
      currentStep: STEP_SEQUENCE_QC[0].label,
      completedSteps: [],
      messages: [
        ...state.messages,
        { id: userMsgId, type: "user", content: hypothesis, timestamp: Date.now() },
        { id: statusMsgId, type: "status", timestamp: Date.now(), meta: { phase: "qc" } },
      ],
      inputValue: "",
      plan: null,
      showQCResult: false,
      showGenerateCTA: false,
      populatedTabs: new Set<CanvasTab>(),
    }));

    // Animate the QC step sequence while the network call runs
    const stagedQC = (async () => {
      for (const step of STEP_SEQUENCE_QC) {
        const t0 = Date.now();
        get().setStep(step.label);
        await delay(step.minMs);
        get().pushCompletedStep({
          id: step.id,
          label: step.label.replace("...", ""),
          status: "done",
          durationMs: Date.now() - t0,
        });
      }
    })();

    try {
      const [plan] = await Promise.all([
        generatePlan(hypothesis, domainOverride ?? undefined),
        stagedQC,
      ]);

      // Persist plan but mark canvas as not yet populated — we wait
      // for the user to click Generate.
      set((state) => ({
        plan,
        showQCResult: true,
        showGenerateCTA: true,
        pipelineStatus: "awaiting_generate",
        currentStep: "Literature check complete",
        messages: [
          ...state.messages,
          {
            id: uid(),
            type: "novelty",
            timestamp: Date.now(),
            meta: {
              status: plan.novelty.status,
              summary: plan.novelty.summary,
              confidence: plan.novelty.confidence,
              references: plan.novelty.references,
            },
          },
          {
            id: uid(),
            type: "generate_cta",
            timestamp: Date.now(),
          },
        ],
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Pipeline failed";
      set((state) => ({
        pipelineStatus: "error",
        pipelineError: message,
        messages: [
          ...state.messages,
          {
            id: uid(),
            type: "system_error",
            content: message,
            timestamp: Date.now(),
          },
        ],
      }));
    }
  },

  // ─────────────────────────────────────────────────────────────────
  // Phase 2: User clicks Generate. The plan was preloaded; we now
  // stage the canvas reveal section-by-section and update the live
  // status block.
  // ─────────────────────────────────────────────────────────────────
  generatePlan: async () => {
    const state = get();
    if (!state.plan) return;

    // Insert a synthetic user message + status message for this phase
    set((s) => ({
      pipelineStatus: "generating",
      completedSteps: [],
      currentStep: STEP_SEQUENCE_GEN[0].label,
      activeTab: "protocol",
      populatedTabs: new Set<CanvasTab>(),
      messages: [
        ...s.messages,
        { id: uid(), type: "user", content: "Generate the full experiment plan.", timestamp: Date.now() },
        { id: uid(), type: "status", timestamp: Date.now(), meta: { phase: "generate" } },
      ],
    }));

    for (const step of STEP_SEQUENCE_GEN) {
      const t0 = Date.now();
      get().setStep(step.label);
      await delay(step.minMs);

      if (step.tab) {
        set((s) => {
          const next = new Set(s.populatedTabs);
          next.add(step.tab as CanvasTab);
          // Auto-switch to first tab; let the user navigate from there
          const activeTab = next.size === 1 && step.tab === "protocol" ? "protocol" : s.activeTab;
          // Materials → switch to materials only if user is still on protocol (user-controlled afterwards)
          let nextActive = activeTab;
          if (step.tab === "materials" && s.activeTab === "protocol" && s.populatedTabs.size <= 1) {
            nextActive = "materials";
          }
          return { populatedTabs: next, activeTab: nextActive };
        });
      }

      get().pushCompletedStep({
        id: step.id,
        label: step.label.replace("...", ""),
        status: "done",
        durationMs: Date.now() - t0,
      });
    }

    // Mark validation + timeline tabs as populated since timeline is part of budget agent
    set((s) => {
      const populated = new Set(s.populatedTabs);
      populated.add("timeline");
      populated.add("validation");
      return {
        populatedTabs: populated,
        pipelineStatus: "complete",
        currentStep: "Plan complete",
        messages: [
          ...s.messages,
          {
            id: uid(),
            type: "assistant",
            content:
              "Your experiment plan is ready. Review each section on the right, download as PDF, or ask me to refine any section.",
            timestamp: Date.now(),
          },
        ],
      };
    });
  },

  // ─────────────────────────────────────────────────────────────────
  // Follow-up turn: user types into chat after the plan is built.
  // Backend classifies which section to update and returns the
  // patched plan section.
  // ─────────────────────────────────────────────────────────────────
  submitFollowUp: async (text: string) => {
    const state = get();
    if (!text.trim() || !state.plan) return;

    set((s) => ({
      messages: [
        ...s.messages,
        { id: uid(), type: "user", content: text, timestamp: Date.now() },
        { id: uid(), type: "regen_status", timestamp: Date.now(), content: "Incorporating your feedback..." },
      ],
      inputValue: "",
      pipelineStatus: "regenerating",
    }));

    try {
      const result = await sendChatTurn({
        message: text,
        plan: state.plan,
      });

      set((s) => {
        const next = { ...s.plan! } as PraxisPlan;
        const updatedTabs = new Set(s.recentlyUpdatedTabs);
        const previousSnapshot: PraxisPlan = JSON.parse(JSON.stringify(s.plan));
        const section = result.section as CanvasTab | undefined;

        if (section && section in next) {
          // @ts-expect-error dynamic patch
          next[section] = result.updated;
          updatedTabs.add(section);
        }

        const lastMsg = s.messages[s.messages.length - 1];
        const cleared = lastMsg?.type === "regen_status" ? s.messages.slice(0, -1) : s.messages;

        return {
          previousPlanSnapshot: previousSnapshot,
          plan: next,
          recentlyUpdatedTabs: updatedTabs,
          activeTab: section ?? s.activeTab,
          pipelineStatus: "complete",
          messages: [
            ...cleared,
            {
              id: uid(),
              type: "assistant",
              content:
                result.summary ??
                `I've updated the **${section ?? "plan"}** section with your feedback.`,
              timestamp: Date.now(),
              meta: { section },
            },
          ],
        };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Update failed";
      set((s) => {
        const lastMsg = s.messages[s.messages.length - 1];
        const cleared = lastMsg?.type === "regen_status" ? s.messages.slice(0, -1) : s.messages;
        return {
          pipelineStatus: "complete",
          messages: [
            ...cleared,
            { id: uid(), type: "system_error", content: message, timestamp: Date.now() },
          ],
        };
      });
    }
  },

  submitFeedback: async (payload: FeedbackPayload) => {
    const { plan } = get();
    if (!plan) return;
    await submitFeedbackApi({
      ...payload,
      planId: plan.meta.plan_id ?? null,
      domainUi: plan.meta.domain,
      experimentType: payload.experimentType ?? plan.meta.experiment_type,
    });
  },

  regenerateSection: async (section: CanvasTab) => {
    const state = get();
    if (!state.plan) return;
    await state.submitFollowUp(
      `Regenerate the ${section} section using my latest corrections.`,
    );
  },

  dismissDiff: (section) =>
    set((s) => {
      const next = new Set(s.recentlyUpdatedTabs);
      next.delete(section);
      return { recentlyUpdatedTabs: next };
    }),
}));
