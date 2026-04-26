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
  } catch (_) {}

  // Strategy 5: Sanitize numeric expressions. LLMs (especially Llama
  // family) sometimes emit Python-style arithmetic in JSON number
  // positions, e.g.:
  //   "unit_cost_usd": 145/50
  //   "total_cost_usd": 0.1 * (sum([x['total_cost_usd'] for x in materials]) - 0)
  // Plain JSON.parse rejects these and so does Groq's server-side
  // json_object validator. We repair them here so the response is still
  // usable.
  const sanitized = sanitizeJsonExpressions(fixed);
  try {
    return { ok: true, data: JSON.parse(sanitized), raw: sanitized };
  } catch (e) {
    return { ok: false, error: e.message, raw: text };
  }
}

/**
 * Replace non-literal numeric expressions in a JSON-ish string with
 * literal numbers. Handles:
 *   - simple a/b, a*b, a-b, a+b expressions of integers/floats
 *   - any field containing Python-style sum(), list comprehensions, or
 *     unsupported function calls → coerced to 0
 * Does not attempt to be a real JS evaluator — only pattern-matches the
 * narrow shapes we've actually seen LLMs emit.
 */
function sanitizeJsonExpressions(input) {
  let out = input;

  // Step A: kill any line whose value contains a Python comprehension
  // or sum()/min()/max() call. We replace the whole value with `0` and
  // preserve the optional trailing comma. Working line-by-line is more
  // robust than character-class regexes because comprehensions contain
  // unbalanced `[`/`]` that confuse boundary tracking. The negative
  // lookahead `(?!")` ensures we never touch a legitimate quoted
  // string value that happens to mention "sum()".
  out = out.replace(
    /^(\s*"[\w]+"\s*:\s*)(?!")[^\n\r]*?(?:sum\s*\(|\[[^\]]*for\s+[a-zA-Z_]\w*\s+in\s+|min\s*\(|max\s*\()[^\n\r]*?(,?)\s*$/gm,
    '$1 0$2',
  );

  // Step B: simple two-operand numeric expressions like 145/50, 42/500,
  // 0.1*1845, 2+3. Compute and inline.
  out = out.replace(
    /:\s*(-?\d+(?:\.\d+)?)\s*([\/\*\+\-])\s*(-?\d+(?:\.\d+)?)(?=[\s,}\]])/g,
    (_, a, op, b) => {
      const x = Number(a);
      const y = Number(b);
      let v;
      switch (op) {
        case '/':
          v = y === 0 ? 0 : x / y;
          break;
        case '*':
          v = x * y;
          break;
        case '+':
          v = x + y;
          break;
        case '-':
          v = x - y;
          break;
        default:
          v = 0;
      }
      // Round to 4 decimals to keep the JSON tidy
      return `: ${Math.round(v * 10000) / 10000}`;
    },
  );

  return out;
}

/**
 * Hash a string — used for cache keys
 */
export function hashString(str) {
  return createHash('sha256').update(str.toLowerCase().trim()).digest('hex').slice(0, 16);
}
