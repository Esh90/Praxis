import { createClient } from '@supabase/supabase-js';
import { embed, cosineSimilarity } from './embedder.js';

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getDbRelevantFeedback(hypothesisText, domain, section, topN = 3) {
  const supabase = getAdminClient();
  if (!supabase) return [];

  const queryEmbedding = await embed(`${section} ${hypothesisText}`);
  const { data, error } = await supabase.rpc('get_relevant_feedback', {
    query_embedding: queryEmbedding,
    filter_domain: domain,
    filter_section: section,
    max_results: topN,
  });

  if (error || !Array.isArray(data)) return [];

  return data.map((row) => ({
    id: row.id,
    section: row.section,
    domain,
    experiment_type: row.experiment_type || '',
    original: row.original_content,
    correction: row.correction,
    reason: row.correction_reason || '',
    rating: row.rating,
    similarity: row.similarity,
    source: 'supabase',
  }));
}

export async function mergeFeedback(localEntries, dbEntries) {
  const merged = [...dbEntries, ...localEntries];
  merged.sort((a, b) => Number(b.similarity || 0) - Number(a.similarity || 0));
  // de-dupe by correction text
  const seen = new Set();
  const out = [];
  for (const e of merged) {
    const key = `${e.section}|${String(e.correction || '')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

export async function scoreLocalFeedback(localEntries, hypothesisText, domain, section) {
  const queryEmbedding = await embed(`${section} ${hypothesisText}`);
  return localEntries.map((f) => ({
    ...f,
    similarity: cosineSimilarity(queryEmbedding, f.embedding),
  }));
}
