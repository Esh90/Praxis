import fs from 'fs';
import path from 'path';
import { hashString } from './jsonSafeParse.js';

const CACHE_DIR = path.join(process.cwd(), 'cache');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Get cached Tavily result for a hypothesis
 * @param {string} hypothesis - Raw hypothesis text
 * @returns {object|null} Cached result or null if not found/expired
 */
export function getCached(hypothesis) {
  if (process.env.ENABLE_TAVILY_CACHE !== 'true') return null;

  const key = hashString(hypothesis);
  const cachePath = path.join(CACHE_DIR, `${key}.json`);

  if (!fs.existsSync(cachePath)) return null;

  try {
    const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    // Cache expires after 7 days
    const ageMs = Date.now() - cached.timestamp;
    if (ageMs > 7 * 24 * 60 * 60 * 1000) {
      fs.unlinkSync(cachePath);
      return null;
    }
    console.log(`[Cache] HIT for hypothesis hash ${key} — 0 Tavily credits used`);
    return cached.data;
  } catch {
    return null;
  }
}

/**
 * Store Tavily result in cache
 */
export function setCached(hypothesis, data) {
  if (process.env.ENABLE_TAVILY_CACHE !== 'true') return;

  const key = hashString(hypothesis);
  const cachePath = path.join(CACHE_DIR, `${key}.json`);

  fs.writeFileSync(
    cachePath,
    JSON.stringify(
      {
        timestamp: Date.now(),
        hypothesis: hypothesis.slice(0, 100),
        data,
      },
      null,
      2,
    ),
  );

  console.log(`[Cache] Stored result for hash ${key}`);
}

