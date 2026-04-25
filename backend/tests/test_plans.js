import { assert, backendBaseUrl, mustJson } from './_util.js';

async function main() {
  const url = `${backendBaseUrl()}/api/plans`;
  const resp = await fetch(url);
  assert(resp.ok, `Plans failed: HTTP ${resp.status}`);
  const data = await mustJson(resp);

  assert(data.ok === true, 'Plans payload missing ok:true');
  assert(Array.isArray(data.plans), 'Plans payload missing plans array');
  assert(data.plans.length >= 1, 'Plans array should not be empty');
  assert(typeof data.plans[0].id === 'string', 'Plan should have id');
  console.log('[pass] plans');
}

main().catch((err) => {
  console.error('[fail] plans:', err?.message || err);
  process.exit(1);
});

