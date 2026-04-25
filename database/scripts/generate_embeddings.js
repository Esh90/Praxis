/**
 * Backfills embeddings for seeded rows using Xenova/all-MiniLM-L6-v2 (384 dims).
 *
 * This script is meant for local/dev usage and requires real Supabase credentials.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { pipeline } from '@xenova/transformers';

import { getSupabaseAdmin } from './_supabase.js';
import { requireEnv } from './_util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

let embedderPromise = null;

async function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedderPromise;
}

async function embedText(text) {
  const embedder = await getEmbedder();
  const out = await embedder(text, { pooling: 'mean', normalize: true });
  const vec = Array.from(out.data);
  if (vec.length !== 384) throw new Error(`Embedding dim ${vec.length} != 384`);
  return vec;
}

async function backfillFeedback(supabase) {
  console.log(chalk.yellow('\n[Embed] Fetching feedback rows with NULL embedding...'));

  const { data, error } = await supabase
    .from('plan_feedback')
    .select('id, section, experiment_type, correction, domain')
    .is('embedding', null);

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    console.log(chalk.green('[Embed] No feedback rows need embedding.'));
    return;
  }

  console.log(chalk.blue(`[Embed] Embedding ${data.length} feedback rows...`));
  for (const row of data) {
    const text = `${row.section} ${row.experiment_type} ${row.correction}`;
    try {
      const vec = await embedText(text);
      const { error: updateError } = await supabase
        .from('plan_feedback')
        .update({ embedding: vec })
        .eq('id', row.id);
      if (updateError) throw new Error(updateError.message);
      console.log(chalk.green(`  ✓ ${row.id}`));
    } catch (e) {
      console.log(chalk.red(`  ✗ ${row.id}: ${e instanceof Error ? e.message : String(e)}`));
    }
  }
}

async function backfillPlans(supabase) {
  console.log(chalk.yellow('\n[Embed] Fetching plan rows with NULL embedding...'));

  const { data, error } = await supabase
    .from('experiment_plans')
    .select('id, hypothesis')
    .is('embedding', null);

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    console.log(chalk.green('[Embed] No plan rows need embedding.'));
    return;
  }

  console.log(chalk.blue(`[Embed] Embedding ${data.length} plan rows...`));
  for (const row of data) {
    try {
      const vec = await embedText(row.hypothesis);
      const { error: updateError } = await supabase
        .from('experiment_plans')
        .update({ embedding: vec })
        .eq('id', row.id);
      if (updateError) throw new Error(updateError.message);
      console.log(chalk.green(`  ✓ ${row.id}`));
    } catch (e) {
      console.log(chalk.red(`  ✗ ${row.id}: ${e instanceof Error ? e.message : String(e)}`));
    }
  }
}

async function run() {
  console.log(chalk.blue.bold('\n═══ PRAXIS EMBEDDING BACKFILL ═══\n'));

  const url = requireEnv('SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = getSupabaseAdmin({ url, serviceRoleKey: serviceKey });

  console.log(chalk.gray('Model: Xenova/all-MiniLM-L6-v2 (384 dims)'));
  await backfillFeedback(supabase);
  await backfillPlans(supabase);
  console.log(chalk.blue.bold('\n═══ Embedding backfill complete ═══\n'));
}

run().catch((err) => {
  console.error(chalk.red('Embedder crashed:'), err instanceof Error ? err.message : err);
  process.exit(1);
});

