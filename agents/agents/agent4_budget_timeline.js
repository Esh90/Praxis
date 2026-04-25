/**
 * Agent 4: Budget + Timeline Generator (Chain 3)
 * Reads protocol + materials to produce financial model and project timeline.
 * Materials subtotal is passed in directly so arithmetic is always correct.
 */

import { callLLM } from '../lib/groqClient.js';
import { safeParse } from '../lib/jsonSafeParse.js';
import { getRelevantFeedback, buildFewShotBlock } from '../lib/feedbackStore.js';

const SYSTEM_PROMPT = `You are a research project manager at a Contract Research Organisation.
You receive a completed protocol and materials list, and generate the BUDGET and TIMELINE.

BUDGET RULES:
- materials_subtotal is provided to you — use it EXACTLY as given, do not recalculate
- labor_estimate_usd: $85/hour for skilled technician. Estimate hours from protocol duration.
- equipment_access_usd: core facility fees for any specialist equipment (plate readers, centrifuges, microscopes, sequencers, bioreactors)
- contingency_usd: EXACTLY 15% of (materials_subtotal + labor_estimate_usd + equipment_access_usd), rounded to nearest dollar
- total_usd: sum of all four above values — must be arithmetically correct
- line_items: list each cost category separately for transparency

TIMELINE RULES:
- Phase 1 is always "Procurement & Preparation" (ordering reagents, preparing solutions)
- Standard reagent delivery: 3-5 business days. Specialty antibodies: 7-10 days. Cell lines: 5-10 days. Animals: 10-14 days.
- Include realistic experimental phases with dependencies
- total_weeks must match the phases
- Most bench experiments: 4-10 weeks total

Return ONLY valid JSON. No markdown. No code fences.

OUTPUT SCHEMA:
{
  "budget": {
    "line_items": [
      { "category": string, "amount_usd": number, "notes": string }
    ],
    "materials_subtotal": number,
    "labor_estimate_usd": number,
    "equipment_access_usd": number,
    "contingency_usd": number,
    "total_usd": number,
    "currency": "USD"
  },
  "timeline": {
    "total_weeks": number,
    "phases": [
      {
        "phase": string,
        "start_week": number,
        "duration_weeks": number,
        "activities": [string],
        "dependencies": [string]
      }
    ]
  }
}`;

export async function generateBudgetTimeline(protocolData, materialsData, parsedHypothesis, hypothesis) {
  console.log('\n[Agent 4] Generating budget and timeline...');

  const corrections = await getRelevantFeedback(hypothesis, parsedHypothesis.domain, 'budget', 2);
  const fewShotBlock = buildFewShotBlock(corrections);

  const userContent = `${fewShotBlock}Generate budget and timeline for this experiment.

Experiment: ${protocolData.plan_title}
Protocol total duration: ${protocolData.protocol.total_duration}
Materials subtotal (USE THIS EXACT NUMBER): $${materialsData.subtotal_usd}
Domain: ${parsedHypothesis.domain}
Organism: ${parsedHypothesis.organism_or_substrate || 'not specified'}

Protocol steps count: ${protocolData.protocol.steps.length}
Materials count: ${materialsData.materials.length}

Key materials (for timeline estimation):
${materialsData.materials
  .filter((m) => ['cell_line', 'animal', 'antibody'].includes(m.category))
  .map(
    (m) =>
      `- ${m.name} (${m.category}): ${m.supplier} — typically requires ${
        m.category === 'animal' ? '10-14' : '5-10'
      } days to arrive`,
  )
  .join('\n') || '- Standard reagents only (3-5 day delivery)'}`;

  try {
    const raw = await callLLM(SYSTEM_PROMPT, userContent, { maxTokens: 3072, temperature: 0.1 });
    const parsed = safeParse(raw);

    if (!parsed.ok) {
      return { ok: false, data: null, error: `Budget JSON parse failed: ${parsed.error}` };
    }

    const data = parsed.data;

    // Arithmetic safety check — recalculate total regardless of what LLM said
    if (data.budget) {
      const { materials_subtotal, labor_estimate_usd, equipment_access_usd } = data.budget;
      const base =
        (materials_subtotal || 0) + (labor_estimate_usd || 0) + (equipment_access_usd || 0);
      data.budget.contingency_usd = Math.round(base * 0.15);
      data.budget.total_usd = Math.round(base + data.budget.contingency_usd);
      data.budget.materials_subtotal = materialsData.subtotal_usd; // Force correct value
      console.log(
        `[Agent 4] Total budget: $${data.budget.total_usd} | Timeline: ${data.timeline?.total_weeks} weeks`,
      );
    }

    return { ok: true, data };
  } catch (error) {
    return { ok: false, data: null, error: error.message };
  }
}

