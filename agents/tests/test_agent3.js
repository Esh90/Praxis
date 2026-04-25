import dotenv from 'dotenv';
dotenv.config();

import chalk from 'chalk';
import { parseHypothesis } from '../agents/agent0_parser.js';
import { generateProtocol } from '../agents/agent2_protocol.js';
import { generateMaterials } from '../agents/agent3_materials.js';

const hypothesis =
  'Supplementing C57BL/6 mice with Lactobacillus rhamnosus GG for 4 weeks will reduce intestinal permeability by at least 30% compared to controls, measured by FITC-dextran assay, due to upregulation of tight junction proteins claudin-1 and occludin.';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function run() {
  console.log(chalk.blue.bold('\n═══ AGENT 3 TESTS: Materials Generator ═══\n'));

  const parsed = await parseHypothesis(hypothesis);
  assert(parsed.ok, `Agent0 parse failed: ${parsed.error}`);

  const protocol = await generateProtocol(parsed.data, hypothesis);
  assert(protocol.ok, `Agent2 protocol failed: ${protocol.error}`);

  const materials = await generateMaterials(protocol.data, parsed.data, hypothesis);
  assert(materials.ok, `Agent3 materials failed: ${materials.error}`);

  const items = materials.data?.materials || [];
  assert(items.length > 0, 'Expected materials > 0');
  for (const m of items) {
    assert(m.supplier, 'Material missing supplier');
    assert(m.catalog_number, 'Material missing catalog_number');
  }
  assert(typeof materials.data.subtotal_usd === 'number' && materials.data.subtotal_usd > 0, 'Invalid subtotal_usd');

  console.log(chalk.green(`✓ Generated ${items.length} materials items | subtotal=$${materials.data.subtotal_usd}`));
  console.table(items.slice(0, 12));
}

run().catch((e) => {
  console.error(chalk.red('\nTest run failed:'), e.message);
  process.exit(1);
});

