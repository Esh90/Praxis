/**
 * Agent 3: Materials Generator (Chain 2)
 * Reads the protocol and generates the materials/supply chain list.
 * Uses the reagent catalog to anchor real catalog numbers.
 */

import { callLLM } from '../lib/groqClient.js';
import { safeParse } from '../lib/jsonSafeParse.js';
import { getRelevantFeedback, buildFewShotBlock } from '../lib/feedbackStore.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.join(__dirname, '..', 'data', 'reagent_catalog.json');
const CATALOG = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

// Build a compact catalog summary to inject into the prompt
const CATALOG_SUMMARY = CATALOG.reagents
  .map((r) => `${r.name} | ${r.supplier} | Cat#: ${r.catalog_number} | ${r.unit} | $${r.price_usd}`)
  .join('\n');

const SYSTEM_PROMPT = `You are a laboratory procurement specialist at a major research institution.
You receive a completed experimental protocol and generate the materials list required to execute it.

APPROVED VENDOR CATALOG (USE THESE FIRST before generating your own):
${CATALOG_SUMMARY}

RULES FOR CATALOG NUMBERS:
- For any reagent that appears in the APPROVED CATALOG above: use EXACTLY the catalog number and price listed
- For reagents NOT in the catalog: use realistic Sigma-Aldrich, Thermo Fisher, Abcam, or ATCC catalog number formats
  - Sigma-Aldrich format: letters+numbers (e.g. A9418-100G, D8537-25ML)
  - Thermo Fisher format: 8-digit number (e.g. 15140122, 10977015)
  - Abcam format: ab followed by 5 digits (e.g. ab12345)
  - ATCC format: letters+numbers (e.g. CCL-2, ATCC 53103)
- Always set "verified": false — you are estimating, not guaranteeing
- Include ALL materials: reagents, consumables, equipment access fees, animals/cell lines

PRICING RULES:
- Use realistic 2024 academic pricing. When uncertain, round UP by 20%
- Include a contingency item at the end: 10% of subtotal

Return ONLY valid JSON. No markdown. No code fences.

OUTPUT SCHEMA:
{
  "materials": [
    {
      "name": string,
      "category": "reagent" | "antibody" | "cell_line" | "animal" | "equipment_fee" | "consumable" | "other",
      "supplier": string,
      "catalog_number": string,
      "quantity": string,
      "unit_cost_usd": number,
      "total_cost_usd": number,
      "notes": string | null,
      "verified": false
    }
  ],
  "subtotal_usd": number,
  "catalog_disclaimer": "Catalog numbers and prices are AI-estimated for budgetary planning purposes. All items must be verified with suppliers before ordering."
}`;

export async function generateMaterials(protocolData, parsedHypothesis, hypothesis) {
  console.log('\n[Agent 3] Generating materials list...');

  const corrections = await getRelevantFeedback(hypothesis, parsedHypothesis.domain, 'materials', 2);
  const fewShotBlock = buildFewShotBlock(corrections);

  const protocolSummary = protocolData.protocol.steps
    .map((s) => `Step ${s.step_number}: ${s.title} — ${s.description?.slice(0, 150)}`)
    .join('\n');

  const userContent = `${fewShotBlock}Generate materials list for this experiment.

Experiment: ${protocolData.plan_title}
Domain: ${parsedHypothesis.domain}
Organism/substrate: ${parsedHypothesis.organism_or_substrate || 'not specified'}
Assay method: ${parsedHypothesis.assay_method || 'not specified'}

Protocol steps:
${protocolSummary}`;

  try {
    const raw = await callLLM(SYSTEM_PROMPT, userContent, { maxTokens: 4096, temperature: 0.1 });
    const parsed = safeParse(raw);

    if (!parsed.ok) {
      return { ok: false, data: null, error: `Materials JSON parse failed: ${parsed.error}` };
    }

    // Verify subtotal arithmetic
    const data = parsed.data;
    if (data.materials && Array.isArray(data.materials)) {
      const calculatedSubtotal = data.materials.reduce((sum, m) => sum + (m.total_cost_usd || 0), 0);
      data.subtotal_usd = Math.round(calculatedSubtotal * 100) / 100;
      console.log(`[Agent 3] Generated ${data.materials.length} materials, subtotal: $${data.subtotal_usd}`);
    }

    return { ok: true, data };
  } catch (error) {
    return { ok: false, data: null, error: error.message };
  }
}

