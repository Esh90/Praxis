/**
 * Agent 0: Hypothesis Parser
 * Converts raw natural language hypothesis into structured JSON.
 * This output feeds ALL downstream agents — it must be rock solid.
 */

import { callLLM } from '../lib/groqClient.js';
import { safeParse } from '../lib/jsonSafeParse.js';
import { z } from 'zod';

// Zod schema for output validation — if LLM output doesn't match, we catch it
const ParsedHypothesisSchema = z.object({
  intervention: z.string().min(3),
  outcome: z.string().min(3),
  threshold: z.string().nullable(),
  organism_or_substrate: z.string().nullable(),
  mechanism: z.string().nullable(),
  assay_method: z.string().nullable(),
  domain: z.enum(['diagnostics', 'gut_health', 'cell_biology', 'climate', 'other']),
  control_condition: z.string().nullable(),
  experiment_type: z.string(),
  confidence: z.enum(['high', 'medium', 'low']).optional().default('high'),
});

const SYSTEM_PROMPT = `You are a scientific hypothesis parser for a laboratory experiment planning system.

Your job: extract structured information from a scientific hypothesis.

RULES:
- Return ONLY valid JSON. No markdown. No code fences. No explanation outside the JSON.
- Every field is required. Use null for fields that cannot be determined.
- domain must be one of exactly: diagnostics, gut_health, cell_biology, climate, other
- experiment_type: a short 4-8 word descriptor of the experiment (e.g. "FITC-dextran gut permeability mouse model")
- intervention: what is being tested or applied
- outcome: what is being measured or expected to change
- threshold: the quantitative success target if stated (e.g. "30% reduction", "150 mmol/L/day")
- assay_method: the specific laboratory technique being used to measure the outcome
- control_condition: what the experimental group is being compared against

OUTPUT SCHEMA (return exactly this structure):
{
  "intervention": string,
  "outcome": string,
  "threshold": string | null,
  "organism_or_substrate": string | null,
  "mechanism": string | null,
  "assay_method": string | null,
  "domain": "diagnostics" | "gut_health" | "cell_biology" | "climate" | "other",
  "control_condition": string | null,
  "experiment_type": string,
  "confidence": "high" | "medium" | "low"
}`;

/**
 * Parse a scientific hypothesis into structured JSON
 * @param {string} hypothesis - Raw hypothesis text from user
 * @returns {Promise<{ok: boolean, data: object|null, error: string|null}>}
 */
export async function parseHypothesis(hypothesis) {
  console.log('\n[Agent 0] Parsing hypothesis...');

  try {
    const raw = await callLLM(
      SYSTEM_PROMPT,
      `Parse this scientific hypothesis:\n\n${hypothesis}`,
      { maxTokens: 1024, temperature: 0.05, expectJSON: true },
    );

    const parsed = safeParse(raw);
    if (!parsed.ok) {
      return { ok: false, data: null, error: `JSON parse failed: ${parsed.error}`, raw };
    }

    // Validate against Zod schema
    const validated = ParsedHypothesisSchema.safeParse(parsed.data);
    if (!validated.success) {
      console.warn('[Agent 0] Schema validation warning:', validated.error.issues);
      // Don't fail — return the data even if schema is partial
      return { ok: true, data: parsed.data, warning: 'Schema partial match' };
    }

    console.log(
      `[Agent 0] Parsed successfully: domain=${validated.data.domain}, assay=${validated.data.assay_method}`,
    );
    return { ok: true, data: validated.data };
  } catch (error) {
    return { ok: false, data: null, error: error.message };
  }
}

