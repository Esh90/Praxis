/**
 * Inserts seed data into Supabase by executing the SQL files in `seeds/`.
 *
 * Like migrations, this script attempts execution via RPC `exec_sql`.
 * If you don't have that RPC, run the seed SQL manually in SQL Editor.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

import { getSupabaseAdmin } from './_supabase.js';
import { readSqlFilesSorted, requireEnv } from './_util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SEEDS_DIR = path.join(__dirname, '..', 'seeds');

async function run() {
  console.log(chalk.blue.bold('\n═══ PRAXIS DATABASE SEEDS ═══\n'));

  const url = requireEnv('SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = getSupabaseAdmin({ url, serviceRoleKey: serviceKey });

  const files = readSqlFilesSorted(SEEDS_DIR);
  console.log(chalk.gray(`Found ${files.length} seed files:`));
  for (const f of files) console.log(chalk.gray(`  → ${f.filename}`));
  console.log('');

  let passed = 0;
  let failed = 0;

  for (const f of files) {
    process.stdout.write(chalk.yellow(`Seeding: ${f.filename} ... `));
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: f.sql });
      if (error) throw new Error(error.message);
      console.log(chalk.green('✓'));
      passed++;
    } catch (err) {
      console.log(chalk.red('✗'));
      console.error(chalk.red(`  ${err instanceof Error ? err.message : String(err)}`));
      console.error(chalk.yellow('  Apply this seed manually in Supabase SQL Editor if needed.'));
      failed++;
    }
  }

  console.log('');
  console.log(chalk.blue.bold(`═══ Seed summary: ${passed} applied, ${failed} failed ═══\n`));
  process.exitCode = failed > 0 ? 1 : 0;
}

run().catch((err) => {
  console.error(chalk.red('Seed runner crashed:'), err instanceof Error ? err.message : err);
  process.exit(1);
});

