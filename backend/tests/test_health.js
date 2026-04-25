import { assert, backendBaseUrl, mustJson } from './_util.js';

async function main() {
  const url = `${backendBaseUrl()}/api/health`;
  let resp;
  try {
    resp = await fetch(url);
  } catch (e) {
    throw new Error('Cannot reach backend');
  }

  assert(resp.ok, `Health failed: HTTP ${resp.status}`);
  const data = await mustJson(resp);
  assert(data.ok === true, 'Health payload missing ok:true');
  console.log('[pass] health');
}

main().catch((err) => {
  console.error('[fail] health:', err?.message || err);
  process.exit(1);
});

