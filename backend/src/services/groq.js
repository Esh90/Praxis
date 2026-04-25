export async function groqGenerate({ apiKey, prompt }) {
  if (!apiKey) {
    const err = new Error('GROQ_API_KEY is not set');
    err.code = 'MISSING_API_KEY';
    throw err;
  }
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    const err = new Error('prompt is required');
    err.code = 'INVALID_PROMPT';
    throw err;
  }

  // Minimal direct HTTP call (no extra deps).
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    const err = new Error(`Groq API error: ${resp.status} ${resp.statusText}${text ? ` - ${text}` : ''}`);
    err.code = 'GROQ_HTTP_ERROR';
    throw err;
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  return { content };
}

