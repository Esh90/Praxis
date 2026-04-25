import dotenv from 'dotenv';
dotenv.config();

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { runPipeline } from '../orchestrator.js';

const hypothesis =
  'Supplementing C57BL/6 mice with Lactobacillus rhamnosus GG for 4 weeks will reduce intestinal permeability by at least 30% compared to controls, measured by FITC-dextran assay, due to upregulation of tight junction proteins claudin-1 and occludin.';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function run() {
  console.log(chalk.blue.bold('\n═══ FULL PIPELINE TEST ═══\n'));

  const t0 = Date.now();
  const result = await runPipeline(hypothesis);
  const dt = Date.now() - t0;

  console.log(chalk.gray(`\nDuration: ${(dt / 1000).toFixed(1)}s`));

  assert(result.finalPlan != null, 'finalPlan is null');
  assert((result.finalPlan.protocol?.steps || []).length >= 6, 'protocol.steps < 6');
  assert((result.finalPlan.materials || []).length > 0, 'materials empty');
  assert((result.finalPlan.budget?.total_usd || 0) > 0, 'budget.total_usd <= 0');

  // In a live demo, QC or Tavily can fail due to missing keys/quota; treat as warning if present.
  if ((result.errors || []).length > 0) {
    console.log(chalk.yellow(`Warnings: ${result.errors.length}`));
    for (const e of result.errors) console.log(chalk.yellow(`- ${e.stage}: ${e.error}`));
  }

  const outPath = path.join(process.cwd(), 'cache', 'test_output.json');
  fs.writeFileSync(outPath, JSON.stringify(result.finalPlan, null, 2));
  console.log(chalk.green(`\n✓ Wrote finalPlan to ${outPath}`));

  console.log(chalk.green.bold('\n✓ FULL PIPELINE PASSED (core sections present)'));
}

run().catch((e) => {
  console.error(chalk.red('\nFull pipeline failed:'), e.message);
  process.exit(1);
});

