import { pipeline } from '@xenova/transformers';

let embedderPromise = null;

async function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedderPromise;
}

export async function embedText384(text) {
  const model = await getEmbedder();
  const out = await model(String(text), { pooling: 'mean', normalize: true });
  const vec = Array.from(out.data);
  if (vec.length !== 384) {
    throw new Error(`Expected 384-dim embedding, got ${vec.length}`);
  }
  return vec;
}
