import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const GROQ_API_KEY = (process.env.GROQ_API_KEY || '').trim();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();

// Primary Groq model (legacy single-model setting kept for backward compat).
const GROQ_MODEL = (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile').trim();

// Groq enforces per-day token quotas PER MODEL within an org. Listing
// several models lets us rotate when one hits its 100k TPD cap, effectively
// multiplying our daily budget without needing a second Groq account.
function parseList(envValue, fallbackList) {
  const list = (envValue || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : fallbackList;
}

const GROQ_CANDIDATES = parseList(process.env.GROQ_MODEL_CANDIDATES, [
  GROQ_MODEL,
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
  'mixtral-8x7b-32768',
]);

// Gemini model order (smallest/fastest first since this is the fallback).
// gemini-1.5-flash was retired in v1beta in 2026 — only use 2.x family.
const GEMINI_CANDIDATES = parseList(process.env.GEMINI_MODEL_CANDIDATES, [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash-latest',
]);

const groq = new Groq({ apiKey: GROQ_API_KEY });
const gemini = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

function isRateLimit(err) {
  const status = err?.status;
  return status === 429 || status === 503 || /rate[_-]?limit|tokens per day|TPD|quota/i.test(err?.message || '');
}

function isModelMissing(err) {
  const msg = err?.message || String(err);
  return /404|not found|not supported|invalid model/i.test(msg);
}

/**
 * Main LLM call function used by all agents.
 *
 * Provider rotation order on token-quota errors:
 *   Groq[0] -> Groq[1] -> ... -> Groq[N] -> Gemini[0] -> Gemini[1] -> ...
 *
 * Non-rate-limit errors (auth, malformed prompt, content filter) abort
 * immediately so we don't waste fallback budget on a deterministic failure.
 *
 * @param {string} systemPrompt - The agent's system prompt
 * @param {string} userContent  - The user message / input data
 * @param {object} options      - { maxTokens, temperature, expectJSON }
 * @returns {Promise<string>}   - Raw text response from LLM
 */
export async function callLLM(systemPrompt, userContent, options = {}) {
  const { maxTokens = 4096, temperature = 0.1, expectJSON = true } = options;

  if (process.env.DEBUG_PROMPTS === 'true') {
    console.log('\n[DEBUG SYSTEM PROMPT]\n', systemPrompt);
    console.log('\n[DEBUG USER CONTENT]\n', userContent);
  }

  const errors = [];

  for (const model of GROQ_CANDIDATES) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        max_tokens: maxTokens,
        temperature,
        ...(expectJSON && { response_format: { type: 'json_object' } }),
      });

      if (errors.length > 0) {
        console.log(`[Groq] Recovered on model "${model}" after ${errors.length} fallback hop(s).`);
      }
      return completion.choices[0]?.message?.content || '';
    } catch (err) {
      const status = err?.status ?? 'n/a';
      const reason = err?.message || String(err);
      errors.push({ provider: 'groq', model, status, reason });

      if (isRateLimit(err)) {
        console.warn(`[Groq] ${model} rate-limited (status=${status}). Trying next model...`);
        continue;
      }
      if (isModelMissing(err)) {
        console.warn(`[Groq] ${model} not available (404). Trying next model...`);
        continue;
      }
      throw enrichError(err, errors);
    }
  }

  if (!gemini) {
    throw new Error(
      `All Groq models exhausted (${GROQ_CANDIDATES.join(', ')}) and GEMINI_API_KEY is not set. ` +
        `Set a Gemini key in agents/.env or wait for the Groq daily quota to reset. ` +
        `Last error: ${summarizeErrors(errors)}`,
    );
  }

  return callGeminiFallback(systemPrompt, userContent, { maxTokens, expectJSON, errors });
}

async function callGeminiFallback(systemPrompt, userContent, { maxTokens, expectJSON, errors }) {
  const combinedPrompt =
    `${systemPrompt}\n\nUser input:\n${userContent}` +
    (expectJSON ? '\n\nReturn ONLY valid JSON. No markdown. No preamble.' : '');

  const generationConfig = {
    maxOutputTokens: maxTokens,
    temperature: 0.1,
    ...(expectJSON && { responseMimeType: 'application/json' }),
  };

  for (const modelName of GEMINI_CANDIDATES) {
    try {
      console.log(`[Fallback] Using Gemini model: ${modelName}`);
      const model = gemini.getGenerativeModel({ model: modelName });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: combinedPrompt }] }],
        generationConfig,
      });
      console.log(`[Fallback] Gemini ${modelName} succeeded.`);
      return result.response.text();
    } catch (err) {
      const reason = err?.message || String(err);
      errors.push({ provider: 'gemini', model: modelName, reason });
      if (isModelMissing(err) || isRateLimit(err)) {
        console.warn(`[Fallback] Gemini ${modelName} unavailable. Trying next model...`);
        continue;
      }
      throw new Error(
        `Gemini fallback failed (${modelName}): ${reason}. Check GEMINI_API_KEY and quota.`,
      );
    }
  }

  throw new Error(
    `All providers exhausted. Tried Groq models [${GROQ_CANDIDATES.join(', ')}] and ` +
      `Gemini models [${GEMINI_CANDIDATES.join(', ')}]. ` +
      `${summarizeErrors(errors)} ` +
      `Wait for daily quota reset, or update GROQ_MODEL_CANDIDATES / GEMINI_MODEL_CANDIDATES in agents/.env.`,
  );
}

function summarizeErrors(errors) {
  if (!errors.length) return '';
  const top = errors.slice(0, 3).map((e) => `${e.provider}/${e.model}: ${truncate(e.reason, 120)}`);
  return `Last errors: ${top.join(' | ')}`;
}

function truncate(s, n) {
  const str = String(s ?? '');
  return str.length > n ? `${str.slice(0, n)}...` : str;
}

function enrichError(err, errors) {
  const msg = err?.message || String(err);
  const wrapped = new Error(`${msg} (after ${errors.length} provider attempt(s))`);
  wrapped.cause = err;
  wrapped.attempts = errors;
  return wrapped;
}
