/**
 * Runs all SQL migration files in order against Supabase.
 *
 * IMPORTANT:
 * - Supabase JS client is not designed for executing arbitrary DDL directly.
 * - For many projects you still apply migrations via Supabase SQL Editor / CLI.
 *
 * This script is included for automation parity, but by default it will:
 * - Print the ordered migration list
 * - Attempt to execute each file via a user-provided RPC `exec_sql(sql_query text)`
 *
 * If you haven't created that RPC, run the SQL files manually in the SQL Editor.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

import { getSupabaseAdmin } from './_supabase.js';
import { readSqlFilesSorted, requireEnv } from './_util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function run() {
  console.log(chalk.blue.bold('\n═══ PRAXIS DATABASE MIGRATIONS ═══\n'));

  const url = requireEnv('SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = getSupabaseAdmin({ url, serviceRoleKey: serviceKey });

  const files = readSqlFilesSorted(MIGRATIONS_DIR);
  console.log(chalk.gray(`Found ${files.length} migration files:`));
  for (const f of files) console.log(chalk.gray(`  → ${f.filename}`));
  console.log('');

  let passed = 0;
  let failed = 0;

  for (const f of files) {
    process.stdout.write(chalk.yellow(`Running: ${f.filename} ... `));
    try {
      // Requires an RPC helper:
      //   create or replace function exec_sql(sql_query text) returns void ...
      const { error } = await supabase.rpc('exec_sql', { sql_query: f.sql });
      if (error) throw new Error(error.message);
      console.log(chalk.green('✓'));
      passed++;
    } catch (err) {
      console.log(chalk.red('✗'));
      console.error(chalk.red(`  ${err instanceof Error ? err.message : String(err)}`));
      console.error(
        chalk.yellow('  Apply this migration manually in Supabase SQL Editor if needed.')
      );
      failed++;
    }
  }

  console.log('');
  console.log(chalk.blue.bold(`═══ Migration summary: ${passed} passed, ${failed} failed ═══\n`));
  process.exitCode = failed > 0 ? 1 : 0;
}

run().catch((err) => {
  console.error(chalk.red('Migration runner crashed:'), err instanceof Error ? err.message : err);
  process.exit(1);
});

