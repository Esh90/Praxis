import dotenv from 'dotenv';
dotenv.config();

import chalk from 'chalk';
import { parseHypothesis } from '../agents/agent0_parser.js';
import { generateProtocol } from '../agents/agent2_protocol.js';

const hypothesis =
  'Supplementing C57BL/6 mice with Lactobacillus rhamnosus GG for 4 weeks will reduce intestinal permeability by at least 30% compared to controls, measured by FITC-dextran assay, due to upregulation of tight junction proteins claudin-1 and occludin.';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function run() {
  console.log(chalk.blue.bold('\n═══ AGENT 2 TESTS: Protocol Generator ═══\n'));

  const parsed = await parseHypothesis(hypothesis);
  assert(parsed.ok, `Agent0 parse failed: ${parsed.error}`);

  const protocol = await generateProtocol(parsed.data, hypothesis);
  assert(protocol.ok, `Agent2 protocol failed: ${protocol.error}`);

  const steps = protocol.data?.protocol?.steps || [];
  assert(steps.length >= 6, `Expected >=6 steps, got ${steps.length}`);
  for (const s of steps) {
    assert(typeof s.step_number === 'number', 'Missing step_number');
    assert(s.title && s.description && s.duration, 'Missing step fields');
  }

  console.log(chalk.green(`✓ Generated ${steps.length} steps`));
  console.log(JSON.stringify(protocol.data, null, 2));
}

run().catch((e) => {
  console.error(chalk.red('\nTest run failed:'), e.message);
  process.exit(1);
});

