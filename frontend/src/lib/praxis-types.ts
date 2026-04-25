export type NoveltyStatus = "Not Found" | "Similar Exists" | "Exact Match";

export interface PraxisPlan {
  novelty: {
    status: NoveltyStatus;
    references: { title: string; authors: string; year: number; doi: string }[];
  };
  protocol: { step: number; title: string; description: string; duration_min: number }[];
  materials: { name: string; category: string; supplier: string; catalog: string; cost: number; quantity: number; unit: string }[];
  budget: {
    labor: number;
    materials: number;
    contingency: number;
    grand_total: number;
    currency: string;
    breakdown_notes: string;
  };
  timeline: { phase: string; weeks: number; start_week: number }[];
  validation: {
    statistical_power: number;
    sample_size_justification: string;
    controls: string[];
    risks: { risk: string; mitigation: string }[];
  };
  meta: { hypothesis: string; domain: string; generated_at: string };
}

export const DOMAINS = ["Diagnostics", "Gut Health", "Cell Biology", "Climate"] as const;
export type Domain = (typeof DOMAINS)[number];
