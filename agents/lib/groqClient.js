import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Main LLM call function used by all agents.
 * Tries Groq first. Falls back to Gemini if Groq quota is exceeded.
 *
 * @param {string} systemPrompt - The agent's system prompt
 * @param {string} userContent - The user message / input data
 * @param {object} options - { maxTokens, temperature, expectJSON }
 * @returns {Promise<string>} - Raw text response from LLM
 */
export async function callLLM(systemPrompt, userContent, options = {}) {
  const {
    maxTokens = 4096,
    temperature = 0.1, // low temp for structured JSON output
    expectJSON = true,
  } = options;

  if (process.env.DEBUG_PROMPTS === 'true') {
    console.log('\n[DEBUG SYSTEM PROMPT]\n', systemPrompt);
    console.log('\n[DEBUG USER CONTENT]\n', userContent);
  }

  // Try Groq first
  try {
    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: maxTokens,
      temperature,
      // Request JSON mode if the agent expects JSON
      ...(expectJSON && { response_format: { type: 'json_object' } }),
    });

    return completion.choices[0]?.message?.content || '';
  } catch (groqError) {
    // Check if it's a rate limit or quota error
    const isRateLimit = groqError.status === 429 || groqError.status === 503;
    console.warn(
      `[Groq] Error: ${groqError.message}. ${
        isRateLimit ? 'Rate limit hit, falling back to Gemini.' : 'Non-rate-limit error.'
      }`,
    );

    if (!isRateLimit) throw groqError; // Don't fall back for non-quota errors

    // Fallback to Gemini
    console.log('[Fallback] Using Gemini 1.5 Flash');
    return callGeminiFallback(systemPrompt, userContent, maxTokens);
  }
}

async function callGeminiFallback(systemPrompt, userContent, maxTokens) {
  const model = gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const combinedPrompt = `${systemPrompt}\n\nUser input:\n${userContent}\n\nReturn ONLY valid JSON. No markdown. No preamble.`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: combinedPrompt }] }],
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.1 },
  });

  return result.response.text();
}

