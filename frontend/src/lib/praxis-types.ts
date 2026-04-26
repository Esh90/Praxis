export type NoveltyStatus = "Not Found" | "Similar Exists" | "Exact Match";

export interface NoveltyReference {
  title: string;
  authors: string;
  year: number;
  doi: string;
  /** Direct URL of the source — required for clickable links */
  url: string;
  /** Source label e.g. "PubMed" / "arXiv" / domain — optional */
  source?: string;
  /** Optional 0-1 relevance score */
  relevance?: number;
}

export interface ProtocolStep {
  step: number;
  title: string;
  description: string;
  duration_min: number;
  /** Optional callout shown alongside the step */
  critical_note?: string | null;
}

export interface MaterialItem {
  name: string;
  category: string;
  supplier: string;
  catalog: string;
  cost: number;
  quantity: number;
  unit: string;
  /** Optional unit cost (vs total cost) for richer rendering */
  unit_cost?: number | null;
}

export interface BudgetSummary {
  labor: number;
  materials: number;
  contingency: number;
  /** Equipment line item (optional, fallback 0) */
  equipment?: number;
  grand_total: number;
  currency: string;
  breakdown_notes: string;
}

export interface TimelinePhase {
  phase: string;
  weeks: number;
  start_week: number;
  /** Optional list of activities for the accordion */
  activities?: string[];
  /** Optional dependencies for the accordion */
  dependencies?: string[];
}

export interface ValidationSummary {
  statistical_power: number;
  sample_size_justification: string;
  controls: string[];
  risks: { risk: string; mitigation: string }[];
  /** Optional structured fields with sensible fallbacks */
  primary_success_criterion?: string | null;
  significance_test?: string | null;
}

export interface PraxisPlan {
  novelty: {
    status: NoveltyStatus;
    references: NoveltyReference[];
    confidence?: string | null;
    summary?: string | null;
    raw?: unknown;
  };
  protocol: ProtocolStep[];
  materials: MaterialItem[];
  budget: BudgetSummary;
  timeline: TimelinePhase[];
  validation: ValidationSummary;
  meta: {
    plan_id?: string | null;
    hypothesis: string;
    domain: string;
    experiment_type?: string;
    plan_title?: string | null;
    executive_summary?: string | null;
    generated_at: string;
    duration_ms?: number | null;
    pipeline_errors?: number;
  };
}

export const DOMAINS = ["Diagnostics", "Gut Health", "Cell Biology", "Climate"] as const;
export type Domain = (typeof DOMAINS)[number];
