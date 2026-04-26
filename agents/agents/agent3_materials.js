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

const SYSTEM_PROMPT = `You are a laboratory procurement specialist at a major research institution. Generate a materials list for the given experimental protocol.

APPROVED VENDOR CATALOG — USE CATALOG NUMBERS FROM THIS LIST FIRST:
${CATALOG_SUMMARY}

═══ CRITICAL JSON RULES — VIOLATIONS WILL BREAK THE APPLICATION ═══

1. ALL numeric fields MUST be pre-computed decimal numbers.
   FORBIDDEN:  "unit_cost_usd": 145/50
   FORBIDDEN:  "unit_cost_usd": 42/500
   FORBIDDEN:  "total_cost_usd": 0.1 * anything
   FORBIDDEN:  any arithmetic operator (+, -, *, /) in a JSON value
   FORBIDDEN:  any function call (sum(), len(), etc.) in a JSON value
   REQUIRED:   "unit_cost_usd": 2.9        ← pre-computed number only
   REQUIRED:   "total_cost_usd": 42.0      ← pre-computed number only

2. DO NOT include a "Contingency item" in the materials array.
   Contingency is calculated by the budget agent, not here.

3. unit_cost_usd must ALWAYS be >= 0.01 (minimum one cent)
   If a per-unit cost is very small (e.g. $0.18 for gloves),
   round up to the pack price instead: $18 for 100 gloves.
   NEVER put fractions of cents in JSON.

4. total_cost_usd = unit_cost_usd × quantity_number
   You must compute this multiplication yourself before writing it.
   Example: 8 mice × $38 each = $304. Write 304, not 8*38.

5. subtotal_usd must equal the arithmetic sum of all total_cost_usd values.
   Compute this yourself. Write the final number.
   Example: 304 + 195 + 285 = 784. Write 784, not a formula.

6. Minimum materials list: 8 items. Maximum: 20 items.
   EVERY experiment needs at minimum:
   - The primary reagent/test compound
   - A control reagent
   - Cell line OR animal (if applicable)
   - Consumables (plates, tubes, gloves)
   - At least one equipment access fee

7. NO item should have total_cost_usd = 0 or unit_cost_usd = 0.
   If you do not know the price, use a reasonable estimate and mark
   notes as "Price estimated — verify with supplier".

═══ PRICING GUIDANCE ═══

Common reagent price ranges (2024 academic pricing):
- Standard buffer/solvent (500mL): $18–$75
- Specialty antibody (100µg): $250–$450
- ELISA kit (96-well): $400–$650
- Cell line vial: $300–$500
- Mouse (C57BL/6, per animal): $35–$50
- Consumables pack: $15–$150
- Equipment core facility fee (per session): $40–$200

When you are unsure: err HIGH by 20%, not low.

═══ OUTPUT SCHEMA ═══

Return ONLY valid JSON matching this schema exactly.
No markdown. No code fences. No explanation outside JSON.

{
  "materials": [
    {
      "name": string,
      "category": "reagent" | "antibody" | "cell_line" | "animal" |
                  "equipment_fee" | "consumable" | "other",
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

export async function generateMaterials(protocolData, parsedHypothesis, hypothesis, options = {}) {
  console.log('\n[Agent 3] Generating materials list...');

  const corrections = await getRelevantFeedback(hypothesis, parsedHypothesis.domain, 'materials', 2);
  const fewShotBlock = buildFewShotBlock(corrections);

  const protocolSummary = protocolData.protocol.steps
    .map((s) => `Step ${s.step_number}: ${s.title} — ${s.description?.slice(0, 150)}`)
    .join('\n');

  // ── Regeneration instruction ─────────────────────────────────────
  // When the chat route is re-running this agent because the user
  // asked for a regeneration, it forwards the user's exact words as
  // `options.regenerationInstruction`. That message is rendered into
  // the prompt as a hard requirement so the LLM cannot ignore it
  // (e.g. "user said price was too high → produce cheaper items").
  const regenBlock = options.regenerationInstruction
    ? [
        '',
        '═══ USER REGENERATION REQUEST — APPLY THIS NOW ═══',
        String(options.regenerationInstruction).trim(),
        'You MUST honour the request above. If it asks for cheaper',
        'materials, choose lower-priced suppliers, smaller pack sizes,',
        'or generic equivalents. If it asks for a different reagent,',
        'replace the offending item. Reflect the change in subtotal.',
        '═══════════════════════════════════════════════════════',
        '',
      ].join('\n')
    : '';

  const userContent = `${fewShotBlock}${regenBlock}Generate materials list for this experiment.

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

    const data = sanitiseMaterials(parsed.data);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, data: null, error: error.message };
  }
}

// ── POST-PROCESS: sanitise all numeric fields ──────────────────────
// LLMs (especially Llama family) sometimes emit Python-style arithmetic
// expressions in JSON number positions, e.g. `145/50`. Even after
// safeParse repairs the JSON, individual values may still be NaN,
// strings, or ridiculous (negative, zero, fractions of a cent). This
// function is the last line of defence before downstream agents and
// the frontend ingest the materials list.
function sanitiseMaterials(data) {
  if (!data || !Array.isArray(data.materials)) return data;

  data.materials = data.materials
    // Drop any LLM-injected contingency rows — Agent 4 owns contingency.
    .filter((item) => {
      const blob = `${item?.name || ''} ${item?.notes || ''}`.toLowerCase();
      return !/contingency/.test(blob);
    })
    .map((item) => {
      let unitCost = coerceNumeric(item.unit_cost_usd, `unit_cost_usd for ${item.name}`);
      let totalCost = coerceNumeric(item.total_cost_usd, `total_cost_usd for ${item.name}`);

      if (!Number.isFinite(unitCost)) {
        unitCost = 10; // fallback: $10 minimum rather than $0
      }
      if (!Number.isFinite(totalCost)) {
        totalCost = unitCost; // assume quantity 1 if total is broken
      }

      // Enforce minimums — never allow $0
      if (unitCost <= 0) unitCost = 10;
      if (totalCost <= 0) totalCost = unitCost;

      return {
        name: String(item.name || 'Unnamed material').trim(),
        category: item.category || 'reagent',
        supplier: item.supplier || 'TBD',
        catalog_number: item.catalog_number || item.catalog || 'TBD',
        quantity: String(item.quantity ?? '1'),
        unit_cost_usd: Math.round(unitCost * 100) / 100,
        total_cost_usd: Math.round(totalCost * 100) / 100,
        notes: item.notes ?? null,
        verified: false,
      };
    });

  // Always recalculate subtotal from actual item totals — never trust LLM's sum
  const calculatedSubtotal = data.materials.reduce(
    (sum, m) => sum + (m.total_cost_usd || 0),
    0,
  );
  data.subtotal_usd = Math.round(calculatedSubtotal * 100) / 100;

  // Safety check: if subtotal is still 0, something is deeply wrong
  if (data.subtotal_usd <= 0) {
    console.error('[Agent 3] CRITICAL: subtotal is 0 after sanitisation');
    data.subtotal_usd = 500; // emergency fallback
  }

  data.catalog_disclaimer =
    data.catalog_disclaimer ||
    'Catalog numbers and prices are AI-estimated for budgetary planning purposes. All items must be verified with suppliers before ordering.';

  console.log(
    `[Agent 3] Sanitised: ${data.materials.length} items, subtotal $${data.subtotal_usd}`,
  );
  return data;
}

/**
 * Coerce an LLM-emitted value into a finite number.
 *
 * IMPORTANT: parseFloat("145/50") returns 145 because it stops at the
 * slash. We detect division/multiplication expression strings FIRST and
 * compute them ourselves so the prompt's #1 forbidden pattern is caught
 * even when safeParse didn't repair it. Anything else that isn't a real
 * number returns NaN so the caller can apply a sensible default.
 */
function coerceNumeric(value, label) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }
  if (typeof value !== 'string') return NaN;

  const trimmed = value.trim();

  // Pattern: "145/50", "42 * 8", "0.5 + 1.2"
  const exprMatch = trimmed.match(/^(-?\d+\.?\d*)\s*([\/\*\+\-])\s*(-?\d+\.?\d*)$/);
  if (exprMatch) {
    const a = parseFloat(exprMatch[1]);
    const b = parseFloat(exprMatch[3]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      switch (exprMatch[2]) {
        case '/':
          if (b !== 0) return a / b;
          break;
        case '*':
          return a * b;
        case '+':
          return a + b;
        case '-':
          return a - b;
      }
    }
  }

  // Strings containing function calls or comprehensions are unrecoverable
  if (/[a-zA-Z_]\s*\(|for\s+\w+\s+in\s/.test(trimmed)) {
    if (label) console.warn(`[Agent 3] Unparseable expression in ${label}: "${trimmed.slice(0, 40)}"`);
    return NaN;
  }

  // Plain "$1,234.56" → 1234.56 — strip any currency / commas
  const cleaned = trimmed.replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}
