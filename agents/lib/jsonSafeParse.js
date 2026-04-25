import { createHash } from 'crypto';

/**
 * Safely parse LLM JSON output with multiple recovery strategies.
 * Never throws — always returns { ok, data, error, raw }.
 */
export function safeParse(text) {
  if (!text || typeof text !== 'string') {
    return { ok: false, error: 'Empty or non-string input', raw: text };
  }

  // Strategy 1: Direct parse (best case)
  try {
    return { ok: true, data: JSON.parse(text), raw: text };
  } catch (_) {}

  // Strategy 2: Strip markdown code fences
  const stripped = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return { ok: true, data: JSON.parse(stripped), raw: stripped };
  } catch (_) {}

  // Strategy 3: Find first { ... } block in the text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return { ok: true, data: JSON.parse(jsonMatch[0]), raw: jsonMatch[0] };
    } catch (_) {}
  }

  // Strategy 4: Attempt to fix common LLM JSON mistakes
  const fixed = stripped
    .replace(/,(\s*[}\]])/g, '$1') // trailing commas
    .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // unquoted keys
    .replace(/:\s*'([^']*)'/g, ': "$1"'); // single-quoted values

  try {
    return { ok: true, data: JSON.parse(fixed), raw: fixed };
  } catch (e) {
    return { ok: false, error: e.message, raw: text };
  }
}

/**
 * Hash a string — used for cache keys
 */
export function hashString(str) {
  return createHash('sha256').update(str.toLowerCase().trim()).digest('hex').slice(0, 16);
}
