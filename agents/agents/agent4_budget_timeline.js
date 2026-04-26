/**
 * Agent 4: Budget + Timeline Generator (Chain 3)
 *
 * Split into TWO calls so neither JSON gets truncated by the LLM:
 *   - generateBudget   — small JSON, server-recomputed totals
 *   - generateTimeline — small JSON, validated phases
 *
 * Both calls use the materials subtotal from Agent 3 as authoritative.
 * The orchestrator wires the two outputs back into the final plan.
 */

import { callLLM } from '../lib/groqClient.js';
import { safeParse } from '../lib/jsonSafeParse.js';

// ─────────────────────────────────────────────────────────────────────
// Part A: Budget only (compact JSON, never truncated)
// ─────────────────────────────────────────────────────────────────────

const BUDGET_SYSTEM_PROMPT = `You are a research finance manager.
Generate a budget for a laboratory experiment.
Return ONLY valid JSON. No markdown. No code fences.

CRITICAL: All values must be pre-computed numbers. No formulas.
No arithmetic expressions. No division signs. Just numbers.

BUDGET CALCULATION RULES:
- materials_subtotal: use the EXACT number provided to you, do not change it
- labor_estimate_usd: total_protocol_hours × 85 (round to nearest dollar)
  Estimate protocol hours from the step descriptions
- equipment_access_usd: sum of core facility fees (plate reader, centrifuge, etc)
  Use $75/session as default if unknown
- contingency_usd: ROUND((materials_subtotal + labor + equipment) × 0.15)
  Pre-compute this number yourself
- total_usd: materials_subtotal + labor + equipment + contingency
  Pre-compute this number yourself

Sanity check: total_usd MUST be greater than materials_subtotal.
If total_usd ≤ materials_subtotal, you have made an error.

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
  }
}`;

const TIMELINE_SYSTEM_PROMPT = `You are a research project manager.
Generate a realistic timeline for a laboratory experiment.
Return ONLY valid JSON. No markdown. No code fences.

TIMELINE RULES:
- Phase 1 is ALWAYS "Procurement & Preparation" (ordering + setup)
- Delivery times: standard reagents 3-5 days, antibodies 7-10 days,
  cell lines 5-10 days, animals 10-14 days
- After procurement: include setup, pilot run, main experiment, analysis
- total_weeks must equal the sum of all phase duration_weeks
- Minimum 4 phases, maximum 7 phases
- Most bench experiments: 4-10 weeks total

OUTPUT SCHEMA:
{
  "timeline": {
    "total_weeks": number,
    "phases": [
      {
        "phase": string,
        "start_week": number,
        "duration_weeks": number,
        "activities": [string, string],
        "dependencies": [string]
      }
    ]
  }
}`;

// ─────────────────────────────────────────────────────────────────────
// Server-side budget enforcement
// We NEVER trust LLM-computed totals. Materials subtotal is anchored
// from Agent 3, then labor/equipment are clamped, contingency is
// recomputed at exactly 15%, and the grand total is summed by us.
// ─────────────────────────────────────────────────────────────────────
function sanitiseBudget(data, materialsSubtotal) {
  const subtotal = Math.max(0, Number(materialsSubtotal) || 0);

  if (!data || !data.budget) {
    // LLM produced nothing usable — synthesise a reasonable budget
    const labor = Math.round(subtotal * 0.4);
    const equipment = Math.round(subtotal * 0.2);
    const base = subtotal + labor + equipment;
    const contingency = Math.round(base * 0.15);
    return {
      budget: {
        line_items: [
          { category: 'Materials & Reagents', amount_usd: subtotal, notes: 'From materials list' },
          { category: 'Labor (technician time)', amount_usd: labor, notes: 'Estimated at $85/hour' },
          { category: 'Equipment access fees', amount_usd: equipment, notes: 'Core facility charges' },
          { category: 'Contingency (15%)', amount_usd: contingency, notes: 'Buffer for overruns' },
        ],
        materials_subtotal: subtotal,
        labor_estimate_usd: labor,
        equipment_access_usd: equipment,
        contingency_usd: contingency,
        total_usd: base + contingency,
        currency: 'USD',
      },
    };
  }

  const b = data.budget;

  // Force materials_subtotal to the SERVER-CALCULATED value, always
  b.materials_subtotal = subtotal;

  // Parse and validate all values — reject expressions, enforce minimums
  b.labor_estimate_usd = Math.max(
    parseFloat(b.labor_estimate_usd) || 0,
    Math.round(subtotal * 0.25), // floor at 25% of materials cost
  );
  b.equipment_access_usd = Math.max(parseFloat(b.equipment_access_usd) || 0, 0);

  // Recalculate contingency (always 15%, always server-side)
  const base = b.materials_subtotal + b.labor_estimate_usd + b.equipment_access_usd;
  b.contingency_usd = Math.round(base * 0.15);

  // Recalculate total (always server-side, never trust LLM)
  b.total_usd = Math.round(base + b.contingency_usd);

  // Sanity check: total must be > materials_subtotal
  if (b.total_usd <= b.materials_subtotal) {
    b.total_usd = Math.round(b.materials_subtotal * 1.55);
  }

  // Sanity check: total must be > $50
  if (b.total_usd < 50) {
    console.error('[Agent 4] CRITICAL: budget total < $50, applying emergency calculation');
    b.total_usd = Math.round(subtotal * 1.55);
  }

  // Round all to 2dp
  ['materials_subtotal', 'labor_estimate_usd', 'equipment_access_usd', 'contingency_usd', 'total_usd']
    .forEach((k) => {
      b[k] = Math.round((b[k] || 0) * 100) / 100;
    });

  // Rewrite line items so the user-facing breakdown matches the
  // recomputed totals exactly. Preserve any LLM notes per category.
  const llmItems = Array.isArray(b.line_items) ? b.line_items : [];
  const noteFor = (matcher) => {
    const hit = llmItems.find((it) => matcher.test(String(it?.category || '')));
    return hit?.notes || '';
  };
  b.line_items = [
    {
      category: 'Materials & reagents',
      amount_usd: b.materials_subtotal,
      notes: noteFor(/material|reagent|consumable/i) || 'Sum of itemized materials list.',
    },
    {
      category: 'Labor (skilled technician)',
      amount_usd: Math.round(b.labor_estimate_usd),
      notes: noteFor(/labor|labour|technician|staff/i) || '$85/hour estimate.',
    },
    {
      category: 'Equipment access fees',
      amount_usd: Math.round(b.equipment_access_usd),
      notes: noteFor(/equipment|core|facility|access/i) || 'Core facility / shared instrument fees.',
    },
    {
      category: 'Contingency (15%)',
      amount_usd: b.contingency_usd,
      notes: '15% buffer for delays, breakage, and price variance.',
    },
  ];
  b.currency = b.currency || 'USD';

  data.budget = b;
  console.log(`[Agent 4] Budget enforced: materials $${b.materials_subtotal} → total $${b.total_usd}`);
  return data;
}

// ─────────────────────────────────────────────────────────────────────
// Public: generateBudget
// ─────────────────────────────────────────────────────────────────────
export async function generateBudget(protocolData, materialsData, parsedHypothesis, options = {}) {
  console.log('\n[Agent 4a] Generating budget...');

  const protocolHours = (protocolData?.protocol?.steps || []).reduce((sum, step) => {
    const d = (step?.duration || '').toLowerCase();
    if (d.includes('overnight')) return sum + 8;
    if (d.includes('day')) {
      const days = parseFloat(d.match(/(\d+\.?\d*)\s*day/)?.[1] || '1');
      return sum + days * 8;
    }
    const hours = parseFloat(d.match(/(\d+\.?\d*)\s*hour/)?.[1] || '0');
    const mins = parseFloat(d.match(/(\d+\.?\d*)\s*min/)?.[1] || '0');
    return sum + hours + mins / 60;
  }, 0);

  const materialsCategories = [...new Set((materialsData?.materials || []).map((m) => m.category))];

  const regenBlock = options.regenerationInstruction
    ? `\n═══ USER REGENERATION REQUEST — APPLY THIS NOW ═══\n${String(options.regenerationInstruction).trim()}\nIf the user asks for a cheaper budget, lower the labor and equipment estimates accordingly while keeping the materials subtotal anchored.\n═══════════════════════════════════════════════════════\n\n`
    : '';

  const userContent = `${regenBlock}Generate the budget for this experiment.

Experiment: ${protocolData?.plan_title || 'Untitled experiment'}
Materials subtotal (USE THIS EXACT NUMBER): ${materialsData?.subtotal_usd ?? 0}
Protocol total hours (estimated): ${protocolHours.toFixed(1)} hours
Domain: ${parsedHypothesis?.domain || 'other'}
Materials categories present: ${materialsCategories.join(', ') || 'reagent'}`;

  try {
    const raw = await callLLM(BUDGET_SYSTEM_PROMPT, userContent, {
      maxTokens: 1024,
      temperature: 0.05,
    });
    const parsed = safeParse(raw);
    const data = sanitiseBudget(parsed.ok ? parsed.data : null, materialsData?.subtotal_usd);
    return { ok: true, data };
  } catch (error) {
    console.warn('[Agent 4a] LLM call failed, using fallback:', error.message);
    return { ok: true, data: sanitiseBudget(null, materialsData?.subtotal_usd) };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Public: generateTimeline
// ─────────────────────────────────────────────────────────────────────
export async function generateTimeline(protocolData, materialsData, parsedHypothesis, options = {}) {
  console.log('\n[Agent 4b] Generating timeline...');

  const specialMaterials =
    (materialsData?.materials || [])
      .filter((m) => ['cell_line', 'animal', 'antibody'].includes(m.category))
      .map((m) => `${m.name} (${m.category}) — expect 7-14 day delivery`)
      .join('\n') || 'Standard reagents only (3-5 day delivery expected)';

  const regenBlock = options.regenerationInstruction
    ? `\n═══ USER REGENERATION REQUEST — APPLY THIS NOW ═══\n${String(options.regenerationInstruction).trim()}\nReshape the timeline accordingly (e.g. shorter phases if the user asked for a faster plan).\n═══════════════════════════════════════════════════════\n\n`
    : '';

  const userContent = `${regenBlock}Generate the timeline for this experiment.

Experiment: ${protocolData?.plan_title || 'Untitled experiment'}
Protocol total duration: ${protocolData?.protocol?.total_duration || 'unspecified'}
Protocol step count: ${protocolData?.protocol?.steps?.length || 0}
Domain: ${parsedHypothesis?.domain || 'other'}
Organism: ${parsedHypothesis?.organism_or_substrate || 'not specified'}

Specialty items requiring longer delivery:
${specialMaterials}`;

  try {
    const raw = await callLLM(TIMELINE_SYSTEM_PROMPT, userContent, {
      maxTokens: 1024,
      temperature: 0.1,
    });
    const parsed = safeParse(raw);

    if (!parsed.ok || !parsed.data?.timeline?.phases?.length) {
      return { ok: true, data: generateFallbackTimeline(protocolData, materialsData) };
    }

    // Validate and fix timeline arithmetic — phases must be sequential
    // and total_weeks must equal the sum of all duration_weeks.
    const timeline = parsed.data.timeline;
    let week = 1;
    timeline.phases = timeline.phases.map((phase) => {
      const duration = Math.max(1, parseInt(phase.duration_weeks) || 1);
      const fixed = {
        phase: String(phase.phase || `Phase ${week}`),
        start_week: week,
        duration_weeks: duration,
        activities: Array.isArray(phase.activities) ? phase.activities.map(String) : [],
        dependencies: Array.isArray(phase.dependencies) ? phase.dependencies.map(String) : [],
      };
      week += duration;
      return fixed;
    });
    timeline.total_weeks = week - 1;

    return { ok: true, data: { timeline } };
  } catch (error) {
    console.warn('[Agent 4b] LLM call failed, using fallback:', error.message);
    return { ok: true, data: generateFallbackTimeline(protocolData, materialsData) };
  }
}

function generateFallbackTimeline(protocolData, materialsData) {
  const mats = materialsData?.materials || [];
  const hasAnimals = mats.some((m) => m.category === 'animal');
  const hasCellLines = mats.some((m) => m.category === 'cell_line');

  const procurementWeeks = hasAnimals ? 2 : hasCellLines ? 2 : 1;

  return {
    timeline: {
      total_weeks: procurementWeeks + 5,
      phases: [
        {
          phase: 'Procurement & Preparation',
          start_week: 1,
          duration_weeks: procurementWeeks,
          activities: [
            'Order all reagents and materials',
            'Prepare solutions and buffers',
            'Calibrate equipment',
          ],
          dependencies: [],
        },
        {
          phase: 'Experimental Setup',
          start_week: procurementWeeks + 1,
          duration_weeks: 1,
          activities: ['Set up experimental conditions', 'Validate controls', 'Pilot run'],
          dependencies: ['Procurement & Preparation'],
        },
        {
          phase: 'Main Experiment',
          start_week: procurementWeeks + 2,
          duration_weeks: 2,
          activities: ['Execute protocol steps', 'Collect samples', 'Monitor controls'],
          dependencies: ['Experimental Setup'],
        },
        {
          phase: 'Data Collection & Analysis',
          start_week: procurementWeeks + 4,
          duration_weeks: 1,
          activities: ['Process samples', 'Run assays', 'Statistical analysis'],
          dependencies: ['Main Experiment'],
        },
        {
          phase: 'Reporting',
          start_week: procurementWeeks + 5,
          duration_weeks: 1,
          activities: ['Compile results', 'Write summary report', 'Review findings'],
          dependencies: ['Data Collection & Analysis'],
        },
      ],
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Backward-compatible single-call wrapper. Kept so the existing chat
// follow-up route (backend/src/routes/praxis.js) keeps working without
// changes — it imports `generateBudgetTimeline` and expects budget +
// timeline in one returned object.
// ─────────────────────────────────────────────────────────────────────
export async function generateBudgetTimeline(protocolData, materialsData, parsedHypothesis, options = {}) {
  const [budgetResult, timelineResult] = await Promise.all([
    generateBudget(protocolData, materialsData, parsedHypothesis, options),
    generateTimeline(protocolData, materialsData, parsedHypothesis, options),
  ]);
  return {
    ok: true,
    data: {
      ...(budgetResult.data || {}),
      ...(timelineResult.data || {}),
    },
  };
}
