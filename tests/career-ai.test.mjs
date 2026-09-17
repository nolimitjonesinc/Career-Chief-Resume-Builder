import assert from "node:assert/strict";
import test from "node:test";
import { handleCareerAI } from "../shared/career-ai.mjs";

const req = (path, body) => new Request(`https://example.test${path}`, { method: body ? "POST" : "GET", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
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
  const response = await handleCareerAI(req("/api/ai/plan", payload), { OPENAI_API_KEY: "test-key" }, fetcher);
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
  const response = await handleCareerAI(req("/api/ai/follow-up", { role: "Marketing Director", question: { prompt: "What did you build?" }, answer: "I built an editorial program with Sales and Operations." }), { OPENAI_API_KEY: "test-key" }, fetcher);
  const result = await response.json();
  assert.equal(result.proposal, "Built an editorial program with Sales and Operations.");
  assert.equal(result.followUp.prompt, "Which decisions were yours?");
});
