/**
 * Validates that core tables + RPC functions exist.
 * Uses service role key (admin) so it can query schema regardless of RLS.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

import { getSupabaseAdmin } from './_supabase.js';
import { requireEnv } from './_util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function run() {
  console.log(chalk.blue.bold('\n═══ PRAXIS SCHEMA VERIFICATION ═══\n'));

  const url = requireEnv('SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = getSupabaseAdmin({ url, serviceRoleKey: serviceKey });

  let passed = 0;
  let failed = 0;

  async function check(name, fn) {
    try {
      const ok = await fn();
      if (ok) {
        passed++;
        console.log(chalk.green(`  ✓ ${name}`));
      } else {
        failed++;
        console.log(chalk.red(`  ✗ ${name}`));
      }
    } catch (e) {
      failed++;
      console.log(chalk.red(`  ✗ ${name} — ${e instanceof Error ? e.message : String(e)}`));
    }
  }

  console.log(chalk.gray('Tables:'));
  await check('experiment_plans exists', async () => {
    const { error } = await supabase.from('experiment_plans').select('id').limit(1);
    return !error;
  });
  await check('plan_feedback exists', async () => {
    const { error } = await supabase.from('plan_feedback').select('id').limit(1);
    return !error;
  });
  await check('tavily_cache exists', async () => {
    const { error } = await supabase.from('tavily_cache').select('id').limit(1);
    return !error;
  });

  console.log(chalk.gray('\nSeed data:'));
  await check('Seed plan id exists', async () => {
    const { data, error } = await supabase
      .from('experiment_plans')
      .select('id')
      .eq('id', '00000000-0000-0000-0001-000000000001')
      .maybeSingle();
    return !error && !!data;
  });

  console.log(chalk.gray('\nRPC functions:'));
  await check('get_dashboard_stats exists', async () => {
    const { error } = await supabase.rpc('get_dashboard_stats');
    return !error;
  });
  await check('get_relevant_feedback exists', async () => {
    const zeroVector = new Array(384).fill(0);
    const { error } = await supabase.rpc('get_relevant_feedback', {
      query_embedding: zeroVector,
      filter_domain: 'other',
      filter_section: 'protocol',
      max_results: 1
    });
    return !error;
  });

  const total = passed + failed;
  console.log('');
  console.log(chalk.blue.bold(`═══ ${passed}/${total} checks passed ═══\n`));
  process.exitCode = failed > 0 ? 1 : 0;
}

run().catch((err) => {
  console.error(chalk.red('Verification crashed:'), err instanceof Error ? err.message : err);
  process.exit(1);
});

