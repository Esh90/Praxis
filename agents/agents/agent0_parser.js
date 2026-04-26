/**
 * Agent 0: Hypothesis Parser
 * Converts raw natural language hypothesis into structured JSON.
 * This output feeds ALL downstream agents — it must be rock solid.
 *
 * Two-pass classification:
 *   1. preClassifyDomain — fast, low-token classification call
 *   2. parseHypothesis — full extraction with the pre-class as a strong prior
 *
 * The user CANNOT override the domain. Manual selection was previously
 * driving QC literature search with the wrong keywords (e.g. a climate
 * hypothesis classified as "other" returned no relevant results). Domain
 * is now always inferred from the hypothesis text.
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
  domain_confidence: z.enum(['high', 'medium', 'low']).optional().default('medium'),
  domain_reasoning: z.string().optional().default(''),
  control_condition: z.string().nullable(),
  experiment_type: z.string(),
  key_search_terms: z.array(z.string()).optional().default([]),
  // legacy alias kept for downstream consumers
  confidence: z.enum(['high', 'medium', 'low']).optional().default('high'),
});

const SYSTEM_PROMPT = `You are a scientific hypothesis classifier and parser for a laboratory experiment planning system.

Your job: classify the domain AND extract structured fields.

═══ DOMAIN CLASSIFICATION RULES ═══

You MUST classify the domain from the hypothesis content.
The user's stated domain preference is irrelevant — classify
from the hypothesis text alone.

Domain definitions:
- "diagnostics": involves detection of biomarkers, sensors, assays
  for disease diagnosis, point-of-care testing, biosensors, ELISA,
  lateral flow, electrochemical detection, antibody detection

- "gut_health": involves gut microbiome, probiotics, intestinal
  permeability, tight junctions, FITC-dextran, mucosal immunity,
  inflammatory bowel, microbiota, colonisation, GI tract

- "cell_biology": involves cell culture, cryopreservation,
  transfection, viability assays, HeLa/HEK/CHO cells, apoptosis,
  proliferation, cytotoxicity, CRISPR, gene expression in cells

- "climate": involves CO2 fixation, carbon capture, bioelectrochemical
  systems, microbial electrosynthesis, renewable energy, biofuel,
  solar cell, photovoltaics, climate change mitigation, acetate
  production, Sporomusa, electrocatalysis

- "other": hypothesis does not fit any above category well. Still
  attempt to classify — use "other" only if genuinely ambiguous.

CLASSIFICATION EXAMPLES:
"Sporomusa ovata at -400mV will fix CO2 into acetate" → "climate"
"Anti-CRP antibody biosensor detects CRP at 0.5 mg/L" → "diagnostics"
"Trehalose cryoprotectant increases HeLa cell viability" → "cell_biology"
"Lactobacillus rhamnosus reduces intestinal permeability" → "gut_health"
"Perovskite solar cells achieve 28% efficiency" → "climate"
"CRISPR knockout of BRCA1 in MCF7 cells" → "cell_biology"

═══ EXPERIMENT TYPE EXTRACTION ═══
experiment_type: a 4-8 word descriptor of the specific assay/method.
This is used for RAG retrieval — be specific.
Good: "FITC-dextran gut permeability mouse model"
Bad: "gut experiment" or "microbiome study"

═══ CRITICAL JSON RULES ═══
Return ONLY valid JSON. No markdown. No code fences. No explanation.
All string fields: use plain text, no special characters.
Null fields: use null, not "null" or "N/A" or "unknown".

OUTPUT SCHEMA (return exactly this):
{
  "intervention": string,
  "outcome": string,
  "threshold": string | null,
  "organism_or_substrate": string | null,
  "mechanism": string | null,
  "assay_method": string | null,
  "domain": "diagnostics" | "gut_health" | "cell_biology" | "climate" | "other",
  "domain_confidence": "high" | "medium" | "low",
  "domain_reasoning": string,
  "control_condition": string | null,
  "experiment_type": string,
  "key_search_terms": [string, string, string]
}

domain_reasoning: one sentence explaining why you chose this domain.
key_search_terms: 3 specific scientific terms from this hypothesis
  to use in literature search. Be precise — use the actual compound
  names, assay names, and organism names from the hypothesis.
  Example: ["Lactobacillus rhamnosus GG", "FITC-dextran assay",
            "intestinal permeability C57BL/6"]`;

const VALID_DOMAINS = ['diagnostics', 'gut_health', 'cell_biology', 'climate', 'other'];

/**
 * Pre-classify the domain with a fast, deterministic LLM call.
 * Used as a prior for the full parse so the downstream extractor doesn't
 * keyword-flip ambiguous hypotheses (e.g. "photovoltaic" containing
 * "volt" tripping the diagnostics classifier).
 */
export async function preClassifyDomain(hypothesis) {
  const classifyPrompt = `Classify this scientific hypothesis into ONE domain.

DOMAINS:
- diagnostics: medical tests, biosensors, biomarker detection, ELISA,
  lateral flow, point-of-care, antibody assays, clinical diagnostics
- gut_health: microbiome, probiotics, intestinal permeability, tight
  junctions, gut bacteria, GI tract, mucosa, colonisation
- cell_biology: cell culture, cryopreservation, transfection, gene
  editing, cell viability, apoptosis, cell signalling, in vitro
- climate: CO2 capture, carbon fixation, solar cells, photovoltaics,
  biofuel, renewable energy, microbial electrosynthesis, bioelectrochemical,
  environmental remediation, greenhouse gas
- other: does not fit above categories

Return ONLY a JSON object: {"domain": "diagnostics|gut_health|cell_biology|climate|other", "confidence": "high|medium|low", "reasoning": "one sentence"}`;

  try {
    const raw = await callLLM(classifyPrompt, `Hypothesis: "${hypothesis}"`, {
      maxTokens: 150,
      temperature: 0.0,
      expectJSON: true,
    });
    const parsed = safeParse(raw);
    if (parsed.ok && parsed.data?.domain && VALID_DOMAINS.includes(parsed.data.domain)) {
      return {
        domain: parsed.data.domain,
        confidence: parsed.data.confidence || 'medium',
        reasoning: parsed.data.reasoning || '',
      };
    }
  } catch (e) {
    console.warn('[Agent 0] Pre-classification failed, continuing with full parse:', e.message);
  }
  return { domain: 'other', confidence: 'low', reasoning: 'Classification failed' };
}

/**
 * Parse a scientific hypothesis into structured JSON.
 *
 * The `options.domainHint` parameter is accepted for backward
 * compatibility but is NO LONGER USED. Domain is always inferred from
 * the hypothesis text. Manual override was harming QC search quality.
 *
 * @param {string} hypothesis - Raw hypothesis text from user
 * @param {object} [options]
 * @returns {Promise<{ok: boolean, data: object|null, error: string|null}>}
 */
export async function parseHypothesis(hypothesis, _options = {}) {
  console.log('\n[Agent 0] Pre-classifying domain...');
  const preClass = await preClassifyDomain(hypothesis);
  console.log(`[Agent 0] Pre-classification: ${preClass.domain} (${preClass.confidence})`);

  const userContent = `Parse this scientific hypothesis.

PRE-CLASSIFICATION RESULT (use this as a strong prior):
Domain: ${preClass.domain} (confidence: ${preClass.confidence})
Reasoning: ${preClass.reasoning}

Only override this classification if the hypothesis clearly belongs
to a different domain. Explain any override in domain_reasoning.

Hypothesis to parse:
"${hypothesis}"`;

  try {
    const raw = await callLLM(SYSTEM_PROMPT, userContent, {
      maxTokens: 1024,
      temperature: 0.05,
      expectJSON: true,
    });

    const parsed = safeParse(raw);
    if (!parsed.ok) {
      return { ok: false, data: null, error: `JSON parse failed: ${parsed.error}`, raw };
    }

    // Defensive defaults — older prompts may not have produced these
    if (parsed.data && typeof parsed.data === 'object') {
      if (!VALID_DOMAINS.includes(parsed.data.domain)) {
        parsed.data.domain = preClass.domain;
      }
      if (!parsed.data.domain_confidence) {
        parsed.data.domain_confidence = preClass.confidence;
      }
      if (!parsed.data.domain_reasoning) {
        parsed.data.domain_reasoning = preClass.reasoning || '';
      }
      if (!Array.isArray(parsed.data.key_search_terms)) {
        parsed.data.key_search_terms = [];
      }
      // Mirror the pre-class confidence into the legacy `confidence` field
      // so consumers that only know the old schema still work.
      parsed.data.confidence = parsed.data.confidence || parsed.data.domain_confidence;
    }

    const validated = ParsedHypothesisSchema.safeParse(parsed.data);
    if (!validated.success) {
      console.warn('[Agent 0] Schema validation warning:', validated.error.issues);
      return { ok: true, data: parsed.data, warning: 'Schema partial match' };
    }

    console.log(
      `[Agent 0] Parsed: domain=${validated.data.domain} (${validated.data.domain_confidence}), assay=${validated.data.assay_method}`,
    );
    return { ok: true, data: validated.data };
  } catch (error) {
    return { ok: false, data: null, error: error.message };
  }
}
