import dotenv from 'dotenv';
dotenv.config();

import chalk from 'chalk';
import { parseHypothesis } from '../agents/agent0_parser.js';
import { generateProtocol } from '../agents/agent2_protocol.js';
import { generateValidation } from '../agents/agent5_validation.js';

const hypothesis =
  'Supplementing C57BL/6 mice with Lactobacillus rhamnosus GG for 4 weeks will reduce intestinal permeability by at least 30% compared to controls, measured by FITC-dextran assay, due to upregulation of tight junction proteins claudin-1 and occludin.';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function run() {
  console.log(chalk.blue.bold('\n═══ AGENT 5 TESTS: Validation Generator ═══\n'));

  const parsed = await parseHypothesis(hypothesis);
  assert(parsed.ok, `Agent0 parse failed: ${parsed.error}`);

  const protocol = await generateProtocol(parsed.data, hypothesis);
  assert(protocol.ok, `Agent2 protocol failed: ${protocol.error}`);

  const validation = await generateValidation(protocol.data, parsed.data, hypothesis);
  assert(validation.ok, `Agent5 validation failed: ${validation.error}`);

  const v = validation.data?.validation;
  assert(v && v.primary_success_criterion, 'Missing primary_success_criterion');
  assert((v.controls || []).length > 0, 'Expected controls > 0');
  assert((v.failure_modes || []).length >= 3, 'Expected failure_modes >= 3');

  console.log(chalk.green('✓ Validation OK'));
  console.log(JSON.stringify(validation.data, null, 2));
}

run().catch((e) => {
  console.error(chalk.red('\nTest run failed:'), e.message);
  process.exit(1);
});

