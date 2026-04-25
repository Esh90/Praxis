/**
 * Master setup script.
 * For first-time setup, apply `migrations/*.sql` in Supabase SQL Editor (or CLI),
 * then run: npm run seed && npm run embed && npm run verify
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run(label, cmd) {
  console.log(chalk.blue(`\n[setup] ${label}`));
  execSync(cmd, { stdio: 'inherit', cwd: __dirname });
}

async function main() {
  console.log(chalk.blue.bold('\n═══ PRAXIS DATABASE SETUP ═══\n'));
  console.log(chalk.yellow('Prerequisite: apply SQL migrations in Supabase first.'));
  console.log(chalk.gray('  database/migrations/000_enable_pgvector.sql'));
  console.log(chalk.gray('  database/migrations/001_experiment_plans.sql'));
  console.log(chalk.gray('  database/migrations/002_plan_feedback.sql'));
  console.log(chalk.gray('  database/migrations/003_tavily_cache.sql'));
  console.log(chalk.gray('  database/migrations/004_rls_policies.sql'));
  console.log(chalk.gray('  database/migrations/005_functions.sql'));
  console.log(chalk.gray('  database/migrations/006_indexes.sql'));

  run('Seeds', 'node scripts/run_seeds.js');
  run('Embeddings', 'node scripts/generate_embeddings.js');
  run('Verify', 'node scripts/verify_schema.js');

  console.log(chalk.green.bold('\nSetup complete.\n'));
}

main().catch((err) => {
  console.error(chalk.red('setup failed:'), err instanceof Error ? err.message : err);
  process.exit(1);
});

