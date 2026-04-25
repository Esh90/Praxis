/**
 * ⚠ DANGER: Drops Praxis tables in Supabase.
 * Development only. Requires explicit confirmation input.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import chalk from 'chalk';

import { getSupabaseAdmin } from './_supabase.js';
import { requireEnv } from './_util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function run() {
  console.log(chalk.red.bold('\n═══ PRAXIS DATABASE RESET (DANGER) ═══\n'));

  if (process.env.NODE_ENV === 'production') {
    console.error(chalk.red('Refusing to reset in production.'));
    process.exit(1);
  }

  const answer = await ask(chalk.red('Type RESET to confirm dropping Praxis tables: '));
  if (answer !== 'RESET') {
    console.log(chalk.yellow('Reset cancelled.'));
    return;
  }

  const url = requireEnv('SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = getSupabaseAdmin({ url, serviceRoleKey: serviceKey });

  // We execute via RPC `exec_sql` so we can drop tables in one shot.
  const sql = `
    DROP TABLE IF EXISTS plan_feedback CASCADE;
    DROP TABLE IF EXISTS tavily_cache CASCADE;
    DROP TABLE IF EXISTS experiment_plans CASCADE;
  `;

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error(chalk.red(`Reset failed: ${error.message}`));
    process.exit(1);
  }

  console.log(chalk.green('Reset complete.'));
}

run().catch((err) => {
  console.error(chalk.red('Reset script crashed:'), err instanceof Error ? err.message : err);
  process.exit(1);
});

