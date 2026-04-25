import { assert, backendBaseUrl, mustJson } from './_util.js';

async function main() {
  if (!process.env.GROQ_API_KEY) {
    console.error('[skip] generate: GROQ_API_KEY is not set in env');
    process.exit(1);
  }

  const resp = await fetch(`${backendBaseUrl()}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Say hello in one short sentence.' })
  });
  assert(resp.ok, `Generate failed: HTTP ${resp.status}`);
  const data = await mustJson(resp);
  assert(data.ok === true, 'Generate payload missing ok:true');
  assert(typeof data.content === 'string', 'Generate payload missing content');
  console.log('[pass] generate');
}

main().catch((err) => {
  console.error('[fail] generate:', err?.message || err);
  process.exit(1);
});

