import assert from "node:assert/strict";
import test from "node:test";
import { assertAccess, handleAccess } from "../shared/access.mjs";
import { handleCareerAI } from "../shared/career-ai.mjs";
import worker from "../worker/index.js";

const env = { ACCESS_CODE: "owner-code, guest-code" };
const asks = (code, extra = {}) => new Request("https://example.test/api/ai/plan", { method: "POST", headers: { origin: "https://example.test", "content-type": "application/json", ...(code ? { "x-access-code": code } : {}) }, body: "{}", ...extra });
const post = (code, ip = "1.1.1.1") => handleAccess(new Request("https://example.test/api/access", { method: "POST", headers: { "x-forwarded-for": ip }, body: JSON.stringify({ code }) }), env);

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
