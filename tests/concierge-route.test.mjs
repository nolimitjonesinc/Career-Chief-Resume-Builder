import assert from "node:assert/strict";
import test from "node:test";
import { handleCareerAI } from "../shared/career-ai.mjs";
import { createMemoryStore } from "../shared/ai-guard.mjs";

const req = (path, body, headers = {}) => new Request(`https://example.test${path}`, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", origin: "https://example.test", ...headers }, body: body ? JSON.stringify(body) : undefined });
const on = (extra = {}) => ({ OPENAI_API_KEY: "test-key", AI_ENABLED: "true", AI_LIMIT_STORE: createMemoryStore(), ...extra });
const modelResponse = (text) => Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text, annotations: [] }] }] });
const VALID_ACTIONS = new Set(["none", "ask", "propose", "challenge", "search", "stage"]);

// The exact payload src/App.jsx sendConcierge posts.
const payload = (extra = {}) => ({
  role: "Brand Marketing Manager",
  company: "Rivermark Health",
  stage: "case",
  currentQuestion: { id: "q1", topic: "Program ownership", prompt: "What did you personally build?" },
  doc: {
    summary: "Brand marketing leader with experience in content and community.",
    roles: [{ title: "Senior Brand Marketing Manager", company: "Rivermark Health", bullets: ["Responsible for brand positioning and customer education."] }],
    highlights: [],
    skills: ["Leadership"],
  },
  known: ["Brand strategy"],
  gaps: ["Measurable growth"],
  requirements: ["Creator program"],
  questions: [{ id: "q1", topic: "Program ownership", prompt: "What did you personally build?" }],
  answers: ["I built the creator program."],
  messages: [{ role: "user", text: "What should I do next?" }],
  message: "What should I do next?",
  ...extra,
});

test("a valid concierge request returns a reply and an action the client accepts", async () => {
  const fetcher = async () => modelResponse(JSON.stringify({ reply: "Start with your strongest fit.", action: { type: "none" } }));
  const response = await handleCareerAI(req("/api/ai/concierge", payload()), on(), fetcher);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(typeof result.reply, "string");
  assert.ok(result.reply.length > 0);
  assert.ok(VALID_ACTIONS.has(result.action?.type), `unexpected action type ${result.action?.type}`);
});

test("a server-validated ask action names a queued question", async () => {
  const fetcher = async () => modelResponse(JSON.stringify({ reply: "Let us settle this one.", action: { type: "ask", questionId: "q1" } }));
  const result = await (await handleCareerAI(req("/api/ai/concierge", payload()), on(), fetcher)).json();
  assert.deepEqual(result.action, { type: "ask", questionId: "q1" });
});

test("an ask naming an unknown question degrades to a plain reply", async () => {
  const fetcher = async () => modelResponse(JSON.stringify({ reply: "Let us settle this one.", action: { type: "ask", questionId: "not-queued" } }));
  const result = await (await handleCareerAI(req("/api/ai/concierge", payload()), on(), fetcher)).json();
  assert.deepEqual(result.action, { type: "none" });
});

test("missing key / AI off returns a clean error and never calls the model", async () => {
  let called = false;
  const fetcher = async () => { called = true; throw new Error("Must not call network"); };
  const response = await handleCareerAI(req("/api/ai/concierge", payload()), {}, fetcher);
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /not connected/);
  assert.equal(called, false);
});

test("a malformed concierge payload is rejected, not answered", async () => {
  const response = await handleCareerAI(req("/api/ai/concierge", { stage: "case" }), on(), async () => { throw new Error("Must not call network"); });
  assert.equal(response.status, 422);
});

test("fresh session with doc null returns 200 with a reply, not 422", async () => {
  // Danny's exact state: 0% ready, no resume pasted yet, so the client sends doc: null.
  const fetcher = async () => modelResponse(JSON.stringify({ reply: "Paste your resume and the job to begin.", action: { type: "none" } }));
  const response = await handleCareerAI(req("/api/ai/concierge", payload({
    role: "",
    company: "",
    stage: "intake",
    currentQuestion: null,
    doc: null,
    known: [],
    gaps: [],
    requirements: [],
    questions: [],
    answers: [],
    messages: [{ role: "user", text: "What should I do first?" }],
    message: "What should I do first?",
  })), on(), fetcher);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(typeof result.reply, "string");
  assert.ok(result.reply.length > 0);
});

test("doc present but with null inner fields returns 200", async () => {
  const fetcher = async () => modelResponse(JSON.stringify({ reply: "Your draft is taking shape.", action: { type: "none" } }));
  const response = await handleCareerAI(req("/api/ai/concierge", payload({
    doc: { summary: null, roles: null, highlights: null, skills: null },
  })), on(), fetcher);
  assert.equal(response.status, 200);
  assert.equal(typeof (await response.json()).reply, "string");
});

test("a wrong-typed doc is still rejected, not answered", async () => {
  const response = await handleCareerAI(req("/api/ai/concierge", payload({ doc: "not-an-object" })), on(), async () => { throw new Error("Must not call network"); });
  assert.equal(response.status, 422);
});
