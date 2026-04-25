import dotenv from 'dotenv';
dotenv.config();

import chalk from 'chalk';
import { parseHypothesis } from '../agents/agent0_parser.js';
import { runLiteratureQC } from '../agents/agent1_qc.js';

const TEST_CASES = [
  {
    name: 'Gut Health (Probiotic)',
    hypothesis:
      'Supplementing C57BL/6 mice with Lactobacillus rhamnosus GG for 4 weeks will reduce intestinal permeability by at least 30% compared to controls, measured by FITC-dextran assay, due to upregulation of tight junction proteins claudin-1 and occludin.',
  },
  {
    name: 'Diagnostics (Biosensor)',
    hypothesis:
      'A paper-based electrochemical biosensor functionalized with anti-CRP antibodies will detect C-reactive protein in whole blood at concentrations below 0.5 mg/L within 10 minutes, matching laboratory ELISA sensitivity without requiring sample preprocessing.',
  },
  {
    name: 'Cell Biology (Cryopreservation)',
    hypothesis:
      'Replacing sucrose with trehalose as a cryoprotectant in the freezing medium will increase post-thaw viability of HeLa cells by at least 15 percentage points compared to the standard DMSO protocol, due to trehalose’s superior membrane stabilization at low temperatures.',
  },
  {
    name: 'Climate (Carbon Capture)',
    hypothesis:
      'Introducing Sporomusa ovata into a bioelectrochemical system at a cathode potential of −400mV vs SHE will fix CO₂ into acetate at a rate of at least 150 mmol/L/day, outperforming current biocatalytic carbon capture benchmarks by at least 20%.',
  },
];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function runTests() {
  console.log(chalk.blue.bold('\n═══ AGENT 1 TESTS: Literature QC ═══\n'));
  let passed = 0;

  for (const tc of TEST_CASES) {
    console.log(chalk.yellow(`\nTest: ${tc.name}`));
    const parsed = await parseHypothesis(tc.hypothesis);
    assert(parsed.ok, `Agent0 parse failed: ${parsed.error}`);

    const qc = await runLiteratureQC(tc.hypothesis, parsed.data);
    assert(qc.ok, `Agent1 QC failed: ${qc.error}`);

    const signal = qc.data?.novelty_signal;
    assert(
      ['not_found', 'similar_work_exists', 'exact_match_found'].includes(signal),
      `Invalid novelty_signal: ${signal}`,
    );

    console.log(chalk.green('  ✓ QC OK'));
    console.log(`    novelty_signal: ${qc.data.novelty_signal}`);
    console.log(`    confidence: ${qc.data.confidence}`);
    console.log(`    references: ${qc.data.references?.length || 0}`);
    passed++;
  }

  console.log(chalk.blue.bold(`\n═══ Results: ${passed}/${TEST_CASES.length} passed ═══`));
}

runTests().catch((e) => {
  console.error(chalk.red('\nTest run failed:'), e.message);
  process.exit(1);
});

