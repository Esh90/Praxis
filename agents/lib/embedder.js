import { pipeline } from '@xenova/transformers';

let embedder = null;

/**
 * Get or initialise the embedding pipeline (lazy loading — only loads on first call)
 */
async function getEmbedder() {
  if (!embedder) {
    console.log('[Embedder] Loading Xenova/all-MiniLM-L6-v2 (first load may take ~10s)...');
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('[Embedder] Model loaded');
  }
  return embedder;
}

/**
 * Generate embedding vector for a text string
 * @param {string} text
 * @returns {Promise<number[]>} 384-dimension vector
 */
export async function embed(text) {
  const model = await getEmbedder();
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

/**
 * Cosine similarity between two vectors
 */
export function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (magA * magB);
}
