/**
 * Agent 5: Validation Generator (Chain 4)
 * Generates the validation approach: success criteria, stats, controls, failure modes.
 */

import { callLLM } from '../lib/groqClient.js';
import { safeParse } from '../lib/jsonSafeParse.js';
import { getRelevantFeedback, buildFewShotBlock } from '../lib/feedbackStore.js';

const SYSTEM_PROMPT = `You are a biostatistician and quality assurance scientist at a research institution.
You receive a scientific hypothesis and protocol, and generate the VALIDATION APPROACH.

RULES:
- primary_success_criterion: must directly reference the exact threshold from the hypothesis (e.g. ">= 30% reduction")
- statistical_approach: name the specific statistical test appropriate for this experiment type
  Common choices: Student's t-test (2 groups), One-way ANOVA (3+ groups), Mann-Whitney U (non-normal data),
  Chi-square (categorical), Pearson/Spearman correlation (relationship), Log-rank (survival)
- sample_size_rationale: state minimum n per group and reference power calculation convention (e.g. "n=6/group provides 80% power at alpha=0.05")
- failure_modes: 3-5 specific, realistic things that could go wrong — be specific to this experiment type
- controls: include positive control, negative control, and vehicle control where applicable

Return ONLY valid JSON. No markdown. No code fences.

OUTPUT SCHEMA:
{
  "validation": {
    "primary_success_criterion": string,
    "secondary_endpoints": [string],
    "statistical_approach": string,
    "significance_threshold": "p < 0.05",
    "sample_size_rationale": string,
    "failure_modes": [string],
    "controls": [string],
    "data_analysis_tools": [string],
    "expected_timeline_for_results": string
  }
}`;

export async function generateValidation(protocolData, parsedHypothesis, hypothesis) {
  console.log('\n[Agent 5] Generating validation approach...');

  const corrections = await getRelevantFeedback(hypothesis, parsedHypothesis.domain, 'validation', 2);
  const fewShotBlock = buildFewShotBlock(corrections);

  const userContent = `${fewShotBlock}Generate the validation approach for this experiment.

Hypothesis: "${hypothesis}"
Intervention: ${parsedHypothesis.intervention}
Outcome: ${parsedHypothesis.outcome}
Threshold: ${parsedHypothesis.threshold || 'not specified'}
Assay method: ${parsedHypothesis.assay_method || 'not specified'}
Control condition: ${parsedHypothesis.control_condition || 'not specified'}
Mechanism: ${parsedHypothesis.mechanism || 'not specified'}
Protocol total duration: ${protocolData.protocol.total_duration}`;

  try {
    const raw = await callLLM(SYSTEM_PROMPT, userContent, { maxTokens: 2048, temperature: 0.15 });
    const parsed = safeParse(raw);

    if (!parsed.ok) {
      return { ok: false, data: null, error: `Validation JSON parse failed: ${parsed.error}` };
    }

    console.log('[Agent 5] Validation approach generated');
    return { ok: true, data: parsed.data };
  } catch (error) {
    return { ok: false, data: null, error: error.message };
  }
}

