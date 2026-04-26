/**
 * Praxis Agent Orchestrator
 * Runs all 5 agents in sequence, passing outputs between them.
 * This is the single entry point for the backend API to call.
 */

import dotenv from 'dotenv';
dotenv.config();

import chalk from 'chalk';
import { parseHypothesis } from './agents/agent0_parser.js';
import { runLiteratureQC } from './agents/agent1_qc.js';
import { generateProtocol } from './agents/agent2_protocol.js';
import { generateMaterials } from './agents/agent3_materials.js';
import { generateBudget, generateTimeline } from './agents/agent4_budget_timeline.js';
import { generateValidation } from './agents/agent5_validation.js';

/**
 * Run the complete Praxis pipeline for a hypothesis
 *
 * @param {string} hypothesis - Raw user hypothesis
 * @param {object} options - { skipQC: bool, skipFeedback: bool, domainHint: string|null }
 *   - domainHint: user-selected domain slug (e.g. "climate"). Threaded into
 *     Agent 0 so QC, protocol, materials, budget, and validation all see
 *     the right domain context — not just the final saved plan.
 * @returns {Promise<object>}
 */
export async function runPipeline(hypothesis, options = {}) {
  const startTime = Date.now();
  const result = {
    hypothesis,
    timestamp: new Date().toISOString(),
    stages: {},
    errors: [],
    finalPlan: null,
    durationMs: 0,
  };

  console.log(chalk.blue.bold('\n══════════════════════════════════════'));
  console.log(chalk.blue.bold('  PRAXIS PIPELINE STARTING'));
  console.log(chalk.blue.bold('══════════════════════════════════════'));
  console.log(chalk.gray(`Hypothesis: "${hypothesis.slice(0, 100)}..."`));

  // ── STAGE 0: Parse Hypothesis ──────────────────────────────────────
  console.log(chalk.yellow('\n[Stage 0] Hypothesis Parser'));
  const parseResult = await parseHypothesis(hypothesis, {
    domainHint: options.domainHint || null,
  });
  result.stages.parse = parseResult;

  if (!parseResult.ok) {
    result.errors.push({ stage: 'parse', error: parseResult.error });
    console.error(chalk.red(`[Stage 0] FAILED: ${parseResult.error}`));
    // Cannot continue without parsed hypothesis
    result.durationMs = Date.now() - startTime;
    return result;
  }
  console.log(
    chalk.green(`[Stage 0] ✓ Domain: ${parseResult.data.domain} | Assay: ${parseResult.data.assay_method}`),
  );

  // ── STAGE 1: Literature QC ─────────────────────────────────────────
  if (!options.skipQC) {
    console.log(chalk.yellow('\n[Stage 1] Literature QC'));
    const qcResult = await runLiteratureQC(hypothesis, parseResult.data);
    result.stages.qc = qcResult;

    if (!qcResult.ok) {
      result.errors.push({ stage: 'qc', error: qcResult.error });
      console.warn(chalk.yellow(`[Stage 1] Warning: ${qcResult.error} — continuing with generation`));
    } else {
      const signal = qcResult.data.novelty_signal;
      const signalColor =
        signal === 'not_found' ? chalk.green : signal === 'similar_work_exists' ? chalk.yellow : chalk.red;
      console.log(signalColor(`[Stage 1] ✓ Novelty: ${signal} | Refs: ${qcResult.data.references?.length || 0}`));
    }
  }

  // ── STAGE 2: Protocol Generation (Chain 1) ─────────────────────────
  console.log(chalk.yellow('\n[Stage 2] Protocol Generator'));
  const protocolResult = await generateProtocol(parseResult.data, hypothesis);
  result.stages.protocol = protocolResult;

  if (!protocolResult.ok) {
    result.errors.push({ stage: 'protocol', error: protocolResult.error });
    console.error(chalk.red(`[Stage 2] FAILED: ${protocolResult.error}`));
    result.durationMs = Date.now() - startTime;
    return result; // Cannot continue without protocol
  }
  console.log(
    chalk.green(`[Stage 2] ✓ ${protocolResult.data.protocol.steps.length} steps | ${protocolResult.data.protocol.total_duration}`),
  );

  // ── STAGE 3: Materials Generation (Chain 2) ────────────────────────
  console.log(chalk.yellow('\n[Stage 3] Materials Generator'));
  const materialsResult = await generateMaterials(protocolResult.data, parseResult.data, hypothesis);
  result.stages.materials = materialsResult;

  if (!materialsResult.ok) {
    result.errors.push({ stage: 'materials', error: materialsResult.error });
    console.warn(chalk.yellow(`[Stage 3] Warning: ${materialsResult.error} — continuing`));
  } else {
    console.log(
      chalk.green(
        `[Stage 3] ✓ ${materialsResult.data.materials?.length} items | Subtotal: $${materialsResult.data.subtotal_usd}`,
      ),
    );
  }

  // ── STAGE 4a: Budget ───────────────────────────────────────────────
  // Split from timeline so neither JSON gets truncated by the LLM. The
  // single-call version was occasionally cutting off the timeline
  // section, leaving the canvas blank.
  console.log(chalk.yellow('\n[Stage 4a] Budget Generator'));
  const budgetResult = await generateBudget(
    protocolResult.data,
    materialsResult.data || { subtotal_usd: 500, materials: [] },
    parseResult.data,
  );
  result.stages.budget = budgetResult;
  if (!budgetResult.ok) {
    result.errors.push({ stage: 'budget', error: budgetResult.error });
    console.warn(chalk.yellow(`[Stage 4a] Warning: ${budgetResult.error}`));
  } else {
    console.log(chalk.green(`[Stage 4a] ✓ Total: $${budgetResult.data?.budget?.total_usd}`));
  }

  // ── STAGE 4b: Timeline ─────────────────────────────────────────────
  console.log(chalk.yellow('\n[Stage 4b] Timeline Generator'));
  const timelineResult = await generateTimeline(
    protocolResult.data,
    materialsResult.data || { subtotal_usd: 500, materials: [] },
    parseResult.data,
  );
  result.stages.timeline = timelineResult;
  if (!timelineResult.ok) {
    result.errors.push({ stage: 'timeline', error: timelineResult.error });
    console.warn(chalk.yellow(`[Stage 4b] Warning: ${timelineResult.error}`));
  } else {
    console.log(
      chalk.green(
        `[Stage 4b] ✓ ${timelineResult.data?.timeline?.total_weeks} weeks, ${timelineResult.data?.timeline?.phases?.length} phases`,
      ),
    );
  }

  // ── STAGE 5: Validation (Chain 4) ──────────────────────────────────
  console.log(chalk.yellow('\n[Stage 5] Validation Generator'));
  const validationResult = await generateValidation(protocolResult.data, parseResult.data, hypothesis);
  result.stages.validation = validationResult;

  if (!validationResult.ok) {
    result.errors.push({ stage: 'validation', error: validationResult.error });
    console.warn(chalk.yellow(`[Stage 5] Warning: ${validationResult.error}`));
  } else {
    console.log(chalk.green(`[Stage 5] ✓ Validation approach generated`));
  }

  // ── ASSEMBLE FINAL PLAN ────────────────────────────────────────────
  result.finalPlan = {
    metadata: {
      hypothesis,
      domain: parseResult.data.domain,
      experiment_type: parseResult.data.experiment_type,
      generated_at: result.timestamp,
      pipeline_errors: result.errors.length,
    },
    parsed_hypothesis: parseResult.data,
    novelty: result.stages.qc?.data || null,
    plan_title: protocolResult.data.plan_title,
    executive_summary: protocolResult.data.executive_summary,
    protocol: protocolResult.data.protocol,
    materials: materialsResult.data?.materials || [],
    materials_subtotal: materialsResult.data?.subtotal_usd || 0,
    materials_disclaimer: materialsResult.data?.catalog_disclaimer || '',
    budget: budgetResult.data?.budget || null,
    timeline: timelineResult.data?.timeline || null,
    validation: validationResult.data?.validation || null,
  };

  result.durationMs = Date.now() - startTime;

  console.log(chalk.blue.bold('\n══════════════════════════════════════'));
  console.log(chalk.green.bold(`  PIPELINE COMPLETE in ${(result.durationMs / 1000).toFixed(1)}s`));
  console.log(chalk.blue.bold('══════════════════════════════════════'));
  if (result.errors.length > 0) {
    console.log(chalk.yellow(`  Warnings: ${result.errors.length} stage(s) had issues`));
  }

  return result;
}

// Allow direct execution for testing
if (process.argv[2] === '--run') {
  const testHypothesis =
    process.argv[3] ||
    'Supplementing C57BL/6 mice with Lactobacillus rhamnosus GG for 4 weeks will reduce intestinal permeability by at least 30% compared to controls, measured by FITC-dextran assay.';

  runPipeline(testHypothesis)
    .then((result) => {
      console.log('\n[OUTPUT] Final plan keys:', Object.keys(result.finalPlan || {}));
      console.log(JSON.stringify(result.finalPlan, null, 2));
    })
    .catch(console.error);
}

