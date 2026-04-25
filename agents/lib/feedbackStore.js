import fs from 'fs';
import path from 'path';
import { embed, cosineSimilarity } from './embedder.js';

const STORE_PATH = path.join(process.cwd(), 'cache', 'feedback_store.json');

function loadStore() {
  if (!fs.existsSync(STORE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function saveStore(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

/**
 * Add a scientist correction to the feedback store
 * @param {object} feedback - { section, domain, experiment_type, original, correction, reason, rating }
 */
export async function addFeedback(feedback) {
  const store = loadStore();
  const textToEmbed = `${feedback.section} ${feedback.experiment_type} ${feedback.correction}`;
  const embedding = await embed(textToEmbed);

  const entry = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    ...feedback,
    embedding,
  };

  store.push(entry);
  saveStore(store);
  console.log(`[FeedbackStore] Stored correction for section: ${feedback.section}`);
  return entry;
}

/**
 * Retrieve top-N relevant corrections for few-shot injection
 * @param {string} hypothesisText - Current hypothesis
 * @param {string} domain - Current experiment domain
 * @param {string} section - Which section we're generating (protocol/materials/etc)
 * @param {number} topN - How many corrections to return
 */
export async function getRelevantFeedback(hypothesisText, domain, section, topN = 3) {
  const store = loadStore();
  if (store.length === 0) return [];

  // Filter by section and domain first
  const relevant = store.filter(
    (f) => f.section === section && (f.domain === domain || !f.domain) && f.rating <= 3, // only pull corrections for low-rated outputs
  );

  if (relevant.length === 0) return [];

  // Embed the current hypothesis and find similar past corrections
  const queryEmbedding = await embed(`${section} ${hypothesisText}`);

  const scored = relevant.map((f) => ({
    ...f,
    similarity: cosineSimilarity(queryEmbedding, f.embedding),
  }));

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topN);
}

/**
 * Build the few-shot injection block for a prompt
 * @param {Array} corrections - From getRelevantFeedback
 */
export function buildFewShotBlock(corrections) {
  if (corrections.length === 0) return '';

  const lines = [
    '=== SCIENTIST CORRECTIONS FROM SIMILAR PREVIOUS EXPERIMENTS ===',
    '(These are real errors found in past AI-generated plans for similar experiments.',
    ' Apply these learnings when generating this plan. Do not repeat these mistakes.)',
    '',
  ];

  corrections.forEach((c, i) => {
    lines.push(`[CORRECTION ${i + 1}]`);
    lines.push(`Section: ${c.section}`);
    lines.push(`Experiment type: ${c.experiment_type || 'similar experiment'}`);
    lines.push(`What the AI got wrong: ${c.original}`);
    lines.push(`Scientist correction: ${c.correction}`);
    lines.push(`Why it was wrong: ${c.reason}`);
    lines.push('');
  });

  lines.push('=== END CORRECTIONS — NOW GENERATE THE PLAN ===');
  lines.push('');

  return lines.join('\n');
}

