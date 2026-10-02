// Read a response body without trusting its size. Used for model responses
// (overflow = reject) and for public web pages (overflow = keep the first part).
export async function readBytesLimited(response, maxBytes, overflow = "throw") {
  const tooBig = () => new Error("TOO_LARGE");
  const declared = Number(response.headers?.get?.("content-length") || 0);
  if (declared > maxBytes && overflow === "throw") throw tooBig();
  if (!response.body?.getReader) {
    const text = await response.text();
    if (text.length > maxBytes) { if (overflow === "throw") throw tooBig(); return new TextEncoder().encode(text.slice(0, maxBytes)); }
    return new TextEncoder().encode(text);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (total + value.byteLength > maxBytes) {
      if (overflow === "throw") { await reader.cancel().catch(() => {}); throw tooBig(); }
      chunks.push(value.slice(0, maxBytes - total));
      total = maxBytes;
      await reader.cancel().catch(() => {});
      break;
    }
    total += value.byteLength;
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return merged;
}

export const readTextLimited = async (response, maxBytes, overflow) => new TextDecoder().decode(await readBytesLimited(response, maxBytes, overflow));
