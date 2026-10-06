import assert from "node:assert/strict";
import test from "node:test";
import { assertAccess, handleAccess } from "../shared/access.mjs";
import { handleCareerAI } from "../shared/career-ai.mjs";
import worker from "../worker/index.js";

const env = { ACCESS_CODE: "owner-code, guest-code" };
const asks = (code, extra = {}) => new Request("https://example.test/api/ai/plan", { method: "POST", headers: { origin: "https://example.test", "content-type": "application/json", ...(code ? { "x-access-code": code } : {}) }, body: "{}", ...extra });
const post = (code, ip = "1.1.1.1") => handleAccess(new Request("https://example.test/api/access", { method: "POST", headers: { "cf-connecting-ip": ip }, body: JSON.stringify({ code }) }), env);

test("no ACCESS_CODE means the site is open", async () => {
  const status = await handleAccess(new Request("https://example.test/api/access"), {});
  assert.deepEqual(await status.json(), { required: false });
  await assertAccess(asks(""), {});
});

test("with a code set, the status says one is required", async () => {
  assert.deepEqual(await (await handleAccess(new Request("https://example.test/api/access"), env)).json(), { required: true });
});

test("either listed code opens the door; wrong or missing ones do not", async () => {
  assert.equal((await post("owner-code")).status, 200);
  assert.equal((await post("  guest-code ")).status, 200);
  assert.equal((await post("nope")).status, 401);
  assert.equal((await post("")).status, 401);
});

test("the AI routes refuse a caller without the code, before anything is spent", async () => {
  const refused = await handleCareerAI(asks(""), { ...env, AI_ENABLED: "true", ANTHROPIC_API_KEY: "x" });
  assert.equal(refused.status, 401);
  const wrong = await handleCareerAI(asks("nope"), { ...env, AI_ENABLED: "true", ANTHROPIC_API_KEY: "x" });
  assert.equal(wrong.status, 401);
  const allowed = await handleCareerAI(asks("guest-code"), { ...env, AI_ENABLED: "true", ANTHROPIC_API_KEY: "x" });
  assert.notEqual(allowed.status, 401);
});

test("the AI status check stays open so the page can load", async () => {
  const response = await handleCareerAI(new Request("https://example.test/api/ai/status"), env);
  assert.equal(response.status, 200);
});

test("the link reader refuses a caller without the code", async () => {
  const request = (code) => new Request("https://example.test/api/extract-url", { method: "POST", headers: { origin: "https://example.test", ...(code ? { "x-access-code": code } : {}) }, body: JSON.stringify({ url: "https://example.com" }) });
  assert.equal((await worker.fetch(request(""), env)).status, 401);
});

test("ten wrong guesses lock that caller out for the hour", async () => {
  for (let i = 0; i < 10; i += 1) await post(`guess-${i}`, "9.9.9.9");
  assert.equal((await post("owner-code", "9.9.9.9")).status, 429);
  assert.equal((await post("owner-code", "8.8.8.8")).status, 200);
});

test("guessing through the AI door counts against the same limit, and a forged forwarding header changes nothing", async () => {
  const guess = (code, forged) => handleCareerAI(new Request("https://example.test/api/ai/plan", { method: "POST", headers: { origin: "https://example.test", "cf-connecting-ip": "7.7.7.7", "x-forwarded-for": forged, "x-access-code": code }, body: "{}" }), { ...env, AI_ENABLED: "true", ANTHROPIC_API_KEY: "x" });
  for (let i = 0; i < 10; i += 1) assert.equal((await guess(`bad-${i}`, `10.0.0.${i}`)).status, 401);
  assert.equal((await guess("owner-code", "10.9.9.9")).status, 429);
  assert.equal((await post("owner-code", "7.7.7.7")).status, 429);
});

test("on Vercel the edge's own address header is used, and a forged Cloudflare header is ignored", async () => {
  const vercel = { ...env, VERCEL: "1" };
  const guess = (code, forged) => handleAccess(new Request("https://example.test/api/access", { method: "POST", headers: { "x-vercel-forwarded-for": "6.6.6.6", "cf-connecting-ip": forged }, body: JSON.stringify({ code }) }), vercel);
  for (let i = 0; i < 10; i += 1) await guess(`bad-${i}`, `10.1.1.${i}`);
  assert.equal((await guess("owner-code", "10.2.2.2")).status, 429);
});
