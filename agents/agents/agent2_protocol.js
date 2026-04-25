/**
 * Agent 2: Protocol Generator (Chain 1)
 * Generates step-by-step experimental protocol.
 * Uses LLM training knowledge — NOT Tavily web retrieval.
 * Supports few-shot injection from the feedback store.
 */

import { callLLM } from '../lib/groqClient.js';
import { safeParse } from '../lib/jsonSafeParse.js';
import { getRelevantFeedback, buildFewShotBlock } from '../lib/feedbackStore.js';
import { z } from 'zod';

const ProtocolSchema = z.object({
  plan_title: z.string(),
  executive_summary: z.string(),
  protocol: z.object({
    total_duration: z.string(),
    steps: z
      .array(
        z.object({
          step_number: z.number(),
          title: z.string(),
          description: z.string(),
          duration: z.string(),
          critical_notes: z.string().nullable().optional(),
        }),
      )
      .min(4)
      .max(14),
  }),
});

const SYSTEM_PROMPT = `You are a senior scientist at a Contract Research Organisation (CRO) with 15+ years of bench experience across molecular biology, biochemistry, and cell biology.

You generate rigorous, step-by-step experimental protocols that real laboratories can execute.

STRICT RULES:
- Minimum 6 steps, maximum 12 steps
- Step 1 must always be: reagent/equipment preparation and setup
- Include at least one CONTROL step explicitly
- Include at least one QUALITY CHECK step
- Each step must have a realistic duration from actual lab practice
- critical_notes: only include if there is a genuinely important safety, accuracy, or timing consideration
- executive_summary: 2-3 sentences describing what this experiment tests and why it matters
- Do NOT make up data or results — describe what to DO, not what will happen
- Return ONLY valid JSON. No markdown. No code fences.

OUTPUT SCHEMA:
{
  "plan_title": string,
  "executive_summary": string,
  "protocol": {
    "total_duration": string,
    "steps": [
      {
        "step_number": number,
        "title": string,
        "description": string,
        "duration": string,
        "critical_notes": string | null
      }
    ]
  }
}`;

export async function generateProtocol(parsedHypothesis, hypothesis) {
  console.log('\n[Agent 2] Generating protocol...');

  // Fetch relevant scientist corrections for few-shot injection (stretch goal)
  const corrections = await getRelevantFeedback(hypothesis, parsedHypothesis.domain, 'protocol', 3);
  const fewShotBlock = buildFewShotBlock(corrections);

  if (corrections.length > 0) {
    console.log(`[Agent 2] Injecting ${corrections.length} scientist correction(s) as few-shot context`);
  }

  const userContent = `${fewShotBlock}Generate a complete experimental protocol for this hypothesis:

Hypothesis: "${hypothesis}"

Parsed details:
- Intervention: ${parsedHypothesis.intervention}
- Outcome to measure: ${parsedHypothesis.outcome}
- Assay method: ${parsedHypothesis.assay_method || 'to be determined'}
- Organism/substrate: ${parsedHypothesis.organism_or_substrate || 'not specified'}
- Success threshold: ${parsedHypothesis.threshold || 'not specified'}
- Control condition: ${parsedHypothesis.control_condition || 'standard control'}
- Mechanism: ${parsedHypothesis.mechanism || 'not specified'}`;

  try {
    const raw = await callLLM(SYSTEM_PROMPT, userContent, { maxTokens: 4096, temperature: 0.15 });
    const parsed = safeParse(raw);

    if (!parsed.ok) {
      return { ok: false, data: null, error: `Protocol JSON parse failed: ${parsed.error}`, raw };
    }

    const validated = ProtocolSchema.safeParse(parsed.data);
    if (!validated.success) {
      console.warn('[Agent 2] Schema partial match — returning raw parsed data');
    }

    const data = validated.success ? validated.data : parsed.data;
    console.log(`[Agent 2] Generated ${data.protocol?.steps?.length || 0} protocol steps`);
    return { ok: true, data, fewShotUsed: corrections.length };
  } catch (error) {
    return { ok: false, data: null, error: error.message };
  }
}

