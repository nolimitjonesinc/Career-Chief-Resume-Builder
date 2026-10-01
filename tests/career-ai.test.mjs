import assert from "node:assert/strict";
import test from "node:test";
import { handleCareerAI } from "../shared/career-ai.mjs";
import { createMemoryStore } from "../shared/ai-guard.mjs";

const req = (path, body, headers = {}) => new Request(`https://example.test${path}`, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", origin: "https://example.test", ...headers }, body: body ? JSON.stringify(body) : undefined });
// A fresh limit store per test so one test's spending never leaks into another.
const on = (extra = {}) => ({ OPENAI_API_KEY: "test-key", AI_ENABLED: "true", AI_LIMIT_STORE: createMemoryStore(), ...extra });
const modelResponse = (text, annotations = []) => Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text, annotations }] }] });

test("AI remains unavailable without a server key and does not transmit candidate text", async () => {
  let called = false;
  const fetcher = async () => { called = true; throw new Error("Must not call network"); };
  const status = await handleCareerAI(req("/api/ai/status"), {}, fetcher);
  assert.deepEqual(await status.json(), { enabled: false });
  const attempt = await handleCareerAI(req("/api/ai/plan", { sources: [] }), {}, fetcher);
  assert.equal(attempt.status, 503);
  assert.equal(called, false);
});

test("public findings require a URL actually cited by research", async () => {
  const payload = { meta: { company: "Example Co", role: "Marketing Director" }, sources: [
    { kind: "resume", text: "Alex Doe led an editorial team.", name: "Resume" },
    { kind: "job", text: "Lead editorial and audience growth.", name: "Job" },
  ] };
  const calls = [];
  const fetcher = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    if (calls.length === 1) return modelResponse("Example Co plans a new editorial program.", [{ type: "url_citation", url: "https://example.com/news", title: "Company news" }]);
    return modelResponse(JSON.stringify({ thesis: "Alex has relevant editorial leadership.", strongestFit: "Editorial leadership", caution: "Growth outcomes need confirmation.", known: ["Led an editorial team"], gaps: ["Measurable growth"], questions: [{ topic: "Results", prompt: "What changed because of the editorial team’s work?", why: "Growth is central to the role.", tip: "Use a supported result." }], research: [
      { title: "Company plans", finding: "Editorial program announced.", implication: "Show operations experience.", url: "https://example.com/news" },
      { title: "Invented claim", finding: "IPO next year.", implication: "Mention IPO.", url: "https://example.com/invented" },
    ] }));
  };
  const response = await handleCareerAI(req("/api/ai/plan", payload), on(), fetcher);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.research.length, 1);
  assert.equal(result.research[0].url, "https://example.com/news");
  assert.equal(result.questions[0].prompt, "What changed because of the editorial team’s work?");
  assert.equal(calls[0].store, false);
  assert.equal(calls[1].store, false);
  assert.equal(calls[0].tools[0].type, "web_search");
});

test("an answer can produce one specific follow-up without web research", async () => {
  const fetcher = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.tools, undefined);
    return modelResponse(JSON.stringify({ proposal: "Built an editorial program with Sales and Operations.", followUp: { topic: "Personal role", prompt: "Which decisions were yours?", why: "Ownership is unclear.", tip: "Name the choices you made." } }));
  };
  const response = await handleCareerAI(req("/api/ai/follow-up", { role: "Marketing Director", question: { prompt: "What did you build?" }, answer: "I built an editorial program with Sales and Operations." }), on(), fetcher);
  const result = await response.json();
  assert.equal(result.proposal, "Built an editorial program with Sales and Operations.");
  assert.equal(result.followUp.prompt, "Which decisions were yours?");
});

test("a key alone does not turn AI on: AI_ENABLED must be true on every runtime", async () => {
  let called = false;
  const fetcher = async () => { called = true; throw new Error("Must not call network"); };
  const keyOnly = { OPENAI_API_KEY: "test-key", AI_LIMIT_STORE: createMemoryStore() };
  assert.deepEqual(await (await handleCareerAI(req("/api/ai/status"), keyOnly, fetcher)).json(), { enabled: false });
  const attempt = await handleCareerAI(req("/api/ai/plan", { sources: [] }), keyOnly, fetcher);
  assert.equal(attempt.status, 503);
  assert.equal(called, false);
  assert.deepEqual(await (await handleCareerAI(req("/api/ai/status"), on(), fetcher)).json(), { enabled: true });
});

test("requests from another site, or with no origin, are refused before any model call", async () => {
  let called = false;
  const fetcher = async () => { called = true; throw new Error("Must not call network"); };
  const body = { question: { prompt: "q" }, answer: "a" };
  const foreign = await handleCareerAI(req("/api/ai/follow-up", body, { origin: "https://evil.example" }), on(), fetcher);
  assert.equal(foreign.status, 403);
  const bare = new Request("https://example.test/api/ai/follow-up", { method: "POST", body: JSON.stringify(body) });
  assert.equal((await handleCareerAI(bare, on(), fetcher)).status, 403);
  assert.equal(called, false);
  const allowed = await handleCareerAI(req("/api/ai/follow-up", body, { origin: "https://app.example" }), on({ AI_ALLOWED_ORIGINS: "https://app.example" }), async () => modelResponse(JSON.stringify({ proposal: "Did it." })));
  assert.equal(allowed.status, 200);
});

test("a caller is rate limited per hour and the day has a hard cap", async () => {
  const fetcher = async () => modelResponse(JSON.stringify({ proposal: "Did it." }));
  const body = { question: { prompt: "q" }, answer: "a" };
  const env = on({ AI_PER_CALLER_HOURLY: "2", AI_DAILY_UNIT_CAP: "3" });
  const headers = { "x-forwarded-for": "203.0.113.5" };
  assert.equal((await handleCareerAI(req("/api/ai/follow-up", body, headers), env, fetcher)).status, 200);
  assert.equal((await handleCareerAI(req("/api/ai/follow-up", body, headers), env, fetcher)).status, 200);
  const limited = await handleCareerAI(req("/api/ai/follow-up", body, headers), env, fetcher);
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get("retry-after"));
  // A different caller still has hourly room, but the day has one unit left, then none.
  assert.equal((await handleCareerAI(req("/api/ai/follow-up", body, { "x-forwarded-for": "198.51.100.9" }), env, fetcher)).status, 200);
  const spent = await handleCareerAI(req("/api/ai/follow-up", body, { "x-forwarded-for": "198.51.100.10" }), env, fetcher);
  assert.equal(spent.status, 429);
  assert.match((await spent.json()).error, /today/);
});

test("an invalid request does not spend budget", async () => {
  const env = on({ AI_DAILY_UNIT_CAP: "1" });
  assert.equal((await handleCareerAI(req("/api/ai/follow-up", { nope: true }), env, async () => modelResponse("{}"))).status, 422);
  assert.equal((await handleCareerAI(req("/api/ai/follow-up", { question: { prompt: "q" }, answer: "a" }), env, async () => modelResponse(JSON.stringify({ proposal: "Did it." })))).status, 200);
});

test("an oversized model response is rejected instead of buffered", async () => {
  const huge = async () => new Response(JSON.stringify({ status: "completed", output: [], pad: "x".repeat(5000) }), { headers: { "content-type": "application/json" } });
  const response = await handleCareerAI(req("/api/ai/follow-up", { question: { prompt: "q" }, answer: "a" }), on({ AI_MAX_RESPONSE_BYTES: "1000" }), huge);
  assert.equal(response.status, 422);
  assert.match((await response.json()).error, /more data than expected/);
});

test("an AI-written line that adds a number the candidate never gave is flagged", async () => {
  const fetcher = async () => modelResponse(JSON.stringify({ proposal: "Grew signups 35% across 4 regions.", followUp: null }));
  const response = await handleCareerAI(req("/api/ai/follow-up", { question: { prompt: "What changed?" }, answer: "Signups grew 35%." }), on(), fetcher);
  assert.deepEqual((await response.json()).unsupportedNumbers, ["4"]);
});

test("ask-for-a-change rewords one line, keeps the request out of the facts, and flags invented figures", async () => {
  let sent;
  const fetcher = async (_url, options) => { sent = JSON.parse(options.body); return modelResponse(JSON.stringify({ proposal: "Led 12 people.", note: "Shortened." })); };
  const response = await handleCareerAI(req("/api/ai/revise", { role: "Director", answer: "I led my team of six.", current: "Led a team of six.", instruction: "make it shorter" }), on(), fetcher);
  const result = await response.json();
  assert.equal(result.proposal, "Led 12 people.");
  assert.deepEqual(result.unsupportedNumbers, ["12"]);
  assert.equal(sent.tools, undefined);
  assert.equal((await handleCareerAI(req("/api/ai/revise", { answer: "a" }), on(), fetcher)).status, 422);
});

test("unknown AI routes are a 404, not a model call", async () => {
  assert.equal((await handleCareerAI(req("/api/ai/other", {}), on(), async () => { throw new Error("no"); })).status, 404);
});
