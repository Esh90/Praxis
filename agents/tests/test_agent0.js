import dotenv from 'dotenv';
dotenv.config();
import chalk from 'chalk';
import { parseHypothesis } from '../agents/agent0_parser.js';

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
      'Replacing sucrose with trehalose as a cryoprotectant in the freezing medium will increase post-thaw viability of HeLa cells by at least 15 percentage points compared to the standard DMSO protocol.',
  },
  {
    name: 'Climate (Carbon Capture)',
    hypothesis:
      'Introducing Sporomusa ovata into a bioelectrochemical system at a cathode potential of -400mV vs SHE will fix CO2 into acetate at a rate of at least 150 mmol/L/day, outperforming current biocatalytic carbon capture benchmarks by at least 20%.',
  },
];

async function runTests() {
  console.log(chalk.blue.bold('\n═══ AGENT 0 TESTS: Hypothesis Parser ═══\n'));
  let passed = 0;

  for (const tc of TEST_CASES) {
    console.log(chalk.yellow(`\nTest: ${tc.name}`));
    const result = await parseHypothesis(tc.hypothesis);

    if (result.ok) {
      const d = result.data;
      console.log(chalk.green('  ✓ Parse OK'));
      console.log(`    domain: ${d.domain}`);
      console.log(`    intervention: ${d.intervention?.slice(0, 60)}`);
      console.log(`    assay_method: ${d.assay_method}`);
      console.log(`    threshold: ${d.threshold}`);
      console.log(`    experiment_type: ${d.experiment_type}`);
      passed++;
    } else {
      console.log(chalk.red(`  ✗ FAILED: ${result.error}`));
    }
  }

  console.log(chalk.blue.bold(`\n═══ Results: ${passed}/${TEST_CASES.length} passed ═══`));
}

runTests().catch(console.error);

