import dotenv from 'dotenv';
dotenv.config();

import chalk from 'chalk';
import { parseHypothesis } from '../agents/agent0_parser.js';
import { generateProtocol } from '../agents/agent2_protocol.js';
import { generateMaterials } from '../agents/agent3_materials.js';
import { generateBudgetTimeline } from '../agents/agent4_budget_timeline.js';

const hypothesis =
  'Supplementing C57BL/6 mice with Lactobacillus rhamnosus GG for 4 weeks will reduce intestinal permeability by at least 30% compared to controls, measured by FITC-dextran assay, due to upregulation of tight junction proteins claudin-1 and occludin.';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function run() {
  console.log(chalk.blue.bold('\n═══ AGENT 4 TESTS: Budget + Timeline ═══\n'));

  const parsed = await parseHypothesis(hypothesis);
  assert(parsed.ok, `Agent0 parse failed: ${parsed.error}`);

  const protocol = await generateProtocol(parsed.data, hypothesis);
  assert(protocol.ok, `Agent2 protocol failed: ${protocol.error}`);

  const materials = await generateMaterials(protocol.data, parsed.data, hypothesis);
  assert(materials.ok, `Agent3 materials failed: ${materials.error}`);

  const budgetTimeline = await generateBudgetTimeline(protocol.data, materials.data, parsed.data, hypothesis);
  assert(budgetTimeline.ok, `Agent4 budget/timeline failed: ${budgetTimeline.error}`);

  const b = budgetTimeline.data?.budget;
  const t = budgetTimeline.data?.timeline;
  assert(b && t, 'Missing budget or timeline');
  assert(b.total_usd > b.materials_subtotal, 'Expected total_usd > materials_subtotal');
  assert((t.phases || []).length > 0, 'Expected at least one phase');

  const calcBase = (b.materials_subtotal || 0) + (b.labor_estimate_usd || 0) + (b.equipment_access_usd || 0);
  const calcCont = Math.round(calcBase * 0.15);
  const calcTotal = Math.round(calcBase + calcCont);
  assert(b.contingency_usd === calcCont, `Contingency mismatch: expected ${calcCont}, got ${b.contingency_usd}`);
  assert(b.total_usd === calcTotal, `Total mismatch: expected ${calcTotal}, got ${b.total_usd}`);

  console.log(chalk.green(`✓ Budget OK: total=$${b.total_usd} | timeline=${t.total_weeks} weeks`));
  console.table(b.line_items || []);
  console.table(t.phases || []);
}

run().catch((e) => {
  console.error(chalk.red('\nTest run failed:'), e.message);
  process.exit(1);
});

