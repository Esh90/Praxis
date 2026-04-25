/**
 * Agent 1: Literature QC
 * Runs Tavily search then classifies novelty using the LLM.
 * Returns a novelty signal and 1-3 references for the UI.
 */

import { callLLM } from '../lib/groqClient.js';
import { safeParse } from '../lib/jsonSafeParse.js';
import { runQCSearch } from '../lib/tavilyClient.js';
import { getCached, setCached } from '../lib/cacheManager.js';
import { z } from 'zod';

const QCResultSchema = z.object({
  novelty_signal: z.enum(['not_found', 'similar_work_exists', 'exact_match_found']),
  confidence: z.enum(['high', 'medium', 'low']),
  references: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
        relevance: z.string(),
      }),
    )
    .max(3),
  summary: z.string(),
});

const SYSTEM_PROMPT = `You are a scientific literature QC assistant for a laboratory experiment planning system.

You receive Tavily search results for a scientific hypothesis.
Your job: classify novelty and identify relevant references.

NOVELTY CLASSIFICATION RULES:
- "exact_match_found": a result clearly describes the SAME intervention + outcome + method
- "similar_work_exists": a result uses the same method OR same intervention, but different context or outcome
- "not_found": results are empty, unrelated, or clearly different experiments

RULES:
- Return ONLY valid JSON. No markdown. No code fences. No explanation.
- references: include ONLY results that are genuinely relevant. Max 3. Can be 0.
- relevance: exactly one sentence explaining scientific relevance to this hypothesis
- summary: exactly one sentence suitable for display in a UI badge

OUTPUT SCHEMA:
{
  "novelty_signal": "not_found" | "similar_work_exists" | "exact_match_found",
  "confidence": "high" | "medium" | "low",
  "references": [
    { "title": string, "url": string, "relevance": string }
  ],
  "summary": string
}`;

export async function runLiteratureQC(hypothesis, parsedHypothesis) {
  console.log('\n[Agent 1] Running literature QC...');

  // Check cache first — saves Tavily credits
  const cached = getCached(hypothesis);
  if (cached) {
    console.log('[Agent 1] Using cached QC result');
    return { ok: true, data: cached, fromCache: true };
  }

  // Run Tavily search
  const { results } = await runQCSearch(parsedHypothesis);

  // Format results for LLM classification
  const resultsText =
    results.length === 0
      ? 'No results found.'
      : results
          .map(
            (r, i) =>
              `Result ${i + 1}:\nTitle: ${r.title}\nURL: ${r.url}\nContent: ${
                r.content?.slice(0, 300) || 'No content'
              }`,
          )
          .join('\n\n');

  const userContent = `Hypothesis: "${hypothesis}"\n\nSearch Results:\n${resultsText}`;

  try {
    const raw = await callLLM(SYSTEM_PROMPT, userContent, { maxTokens: 1024, temperature: 0.1 });
    const parsed = safeParse(raw);

    if (!parsed.ok) {
      // Fallback: if LLM fails, default to not_found
      const fallback = {
        novelty_signal: 'not_found',
        confidence: 'low',
        references: [],
        summary: 'Literature check could not be completed.',
      };
      return { ok: true, data: fallback, warning: 'LLM parse failed, used fallback' };
    }

    const validated = QCResultSchema.safeParse(parsed.data);
    const data = validated.success ? validated.data : parsed.data;

    // Cache the result
    setCached(hypothesis, data);

    console.log(`[Agent 1] Novelty signal: ${data.novelty_signal} (confidence: ${data.confidence})`);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, data: null, error: error.message };
  }
}

