export function backendBaseUrl() {
  return process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
}

export async function mustJson(resp) {
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON but got: ${text.slice(0, 300)}`);
  }
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

