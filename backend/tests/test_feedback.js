import { assert, backendBaseUrl, mustJson } from './_util.js';

async function main() {
  const base = backendBaseUrl();

  const postResp = await fetch(`${base}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Great app', rating: 5, meta: { source: 'test' } })
  });
  assert(postResp.status === 201, `Expected 201, got ${postResp.status}`);
  const postData = await mustJson(postResp);
  assert(postData.ok === true, 'Feedback POST missing ok:true');
  assert(typeof postData.feedback?.id === 'string', 'Feedback POST missing id');

  const listResp = await fetch(`${base}/api/feedback`);
  assert(listResp.ok, `Feedback GET failed: HTTP ${listResp.status}`);
  const listData = await mustJson(listResp);
  assert(listData.ok === true, 'Feedback GET missing ok:true');
  assert(Array.isArray(listData.feedback), 'Feedback GET missing feedback array');
  assert(listData.feedback.length >= 1, 'Feedback list should contain at least one entry');

  console.log('[pass] feedback');
}

main().catch((err) => {
  console.error('[fail] feedback:', err?.message || err);
  process.exit(1);
});

