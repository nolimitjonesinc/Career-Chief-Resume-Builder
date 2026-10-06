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
  assert.deepEqual(await (await handleCareerAI(req("/api/ai/status"), on(), fetcher)).json(), { enabled: true, provider: "openai" });
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

test("OPENAI_BASE_URL redirects provider calls to a gateway", async () => {
  let seen;
  const fetcher = async (url) => { seen = String(url); return modelResponse(JSON.stringify({ proposal: "Did it." })); };
  await handleCareerAI(req("/api/ai/follow-up", { question: { prompt: "q" }, answer: "a" }), on({ OPENAI_BASE_URL: "http://127.0.0.1:8788/v1/" }), fetcher);
  assert.equal(seen, "http://127.0.0.1:8788/v1/responses");
});

test("default limits fit one real interview: a plan, a dozen answer checks and a few rewrites", async () => {
  const env = on();
  const headers = { "x-forwarded-for": "203.0.113.77" };
  const plan = { meta: { company: "", role: "R" }, sources: [{ kind: "resume", text: "Alex led a team.", name: "R" }, { kind: "job", text: "Lead.", name: "J" }] };
  const fetcher = async (_u, options) => {
    const body = JSON.parse(options.body);
    if (String(body.instructions).includes("revising ONE")) return modelResponse(JSON.stringify({ proposal: "Led a team.", note: "" }));
    if (String(body.instructions).includes("FOLLOW-UP RULES")) return modelResponse(JSON.stringify({ proposal: "Led a team.", followUp: null }));
    return modelResponse(JSON.stringify({ thesis: "t", strongestFit: "f", caution: "c", known: [], gaps: [], questions: [{ topic: "T", prompt: "P?", why: "w", tip: "t" }], research: [] }));
  };
  const statuses = [(await handleCareerAI(req("/api/ai/plan", plan, headers), env, fetcher)).status];
  for (let i = 0; i < 12; i += 1) statuses.push((await handleCareerAI(req("/api/ai/follow-up", { question: { prompt: "q" }, answer: "a" }, headers), env, fetcher)).status);
  for (let i = 0; i < 3; i += 1) statuses.push((await handleCareerAI(req("/api/ai/revise", { answer: "a", current: "c", instruction: "shorter" }, headers), env, fetcher)).status);
  assert.deepEqual([...new Set(statuses)], [200]);
});

test("wrong-typed bodies are rejected before any budget is spent or model is called, without leaking internals", async () => {
  let called = false;
  const fetcher = async () => { called = true; return modelResponse("{}"); };
  const env = on({ AI_DAILY_UNIT_CAP: "1" });
  const bad = [
    ["/api/ai/follow-up", { question: { prompt: "q" }, answer: "a", priorAnswers: "abc" }],
    ["/api/ai/follow-up", { question: { prompt: "q" }, answer: 5 }],
    ["/api/ai/follow-up", { question: { prompt: "q" }, answer: "a", askedTopics: [1] }],
    ["/api/ai/revise", { answer: "a", current: "c", instruction: ["x"] }],
    ["/api/ai/plan", { sources: [null] }],
    ["/api/ai/plan", { sources: [{ kind: "resume", text: 5 }] }],
  ];
  for (const [path, body] of bad) {
    const response = await handleCareerAI(req(path, body), env, fetcher);
    assert.equal(response.status, 422, path);
    const { error } = await response.json();
    assert.ok(!/is not a function|Cannot read|undefined/.test(error), error);
  }
  assert.equal(called, false);
  // None of that spent the single daily unit.
  assert.equal((await handleCareerAI(req("/api/ai/follow-up", { question: { prompt: "q" }, answer: "a" }), env, async () => modelResponse(JSON.stringify({ proposal: "Did it." })))).status, 200);
});

test("an oversized request body is refused", async () => {
  const huge = new Request("https://example.test/api/ai/follow-up", { method: "POST", headers: { origin: "https://example.test", "content-type": "application/json" }, body: JSON.stringify({ question: { prompt: "q" }, answer: "a".repeat(500_000) }) });
  const response = await handleCareerAI(huge, on(), async () => { throw new Error("no"); });
  assert.equal(response.status, 422);
});

// ---- Claude (Anthropic) path ----
const claudeOn = (extra = {}) => ({ ANTHROPIC_API_KEY: "test-claude-key", AI_ENABLED: "true", AI_LIMIT_STORE: createMemoryStore(), ...extra });
const claudeResponse = (text, citations = [], extra = {}) => Response.json({ stop_reason: "end_turn", content: [{ type: "text", text, ...(citations.length ? { citations } : {}) }], usage: { input_tokens: 10, output_tokens: 5 }, ...extra });

test("a Claude key alone turns AI on, and the status says which provider", async () => {
  const status = await handleCareerAI(req("/api/ai/status"), claudeOn());
  assert.deepEqual(await status.json(), { enabled: true, provider: "anthropic" });
  const both = await handleCareerAI(req("/api/ai/status"), claudeOn({ OPENAI_API_KEY: "x", CAREER_AI_PROVIDER: "openai" }));
  assert.deepEqual(await both.json(), { enabled: true, provider: "openai" });
});

test("Claude path: research cites real URLs, uses Haiku, sends the key as a header", async () => {
  const payload = { meta: { company: "Example Co", role: "Marketing Director" }, sources: [
    { kind: "resume", text: "Alex Doe led an editorial team.", name: "Resume" },
    { kind: "job", text: "Lead editorial and audience growth.", name: "Job" },
  ] };
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url: String(url), headers: options.headers, body: JSON.parse(options.body) });
    if (calls.length === 1) return claudeResponse("Example Co plans a new editorial program.", [{ type: "web_search_result_location", url: "https://example.com/news", title: "Company news" }]);
    return claudeResponse("```json\n" + JSON.stringify({ thesis: "Alex has relevant editorial leadership.", strongestFit: "Editorial leadership", caution: "Growth outcomes need confirmation.", known: ["Led an editorial team"], gaps: ["Measurable growth"], questions: [{ topic: "Results", prompt: "What changed because of the editorial team’s work?", why: "Growth is central.", tip: "Use a supported result." }], research: [
      { title: "Company plans", finding: "Editorial program announced.", implication: "Show operations experience.", url: "https://example.com/news" },
      { title: "Invented claim", finding: "IPO next year.", implication: "Mention IPO.", url: "https://example.com/invented" },
    ] }) + "\n```");
  };
  const response = await handleCareerAI(req("/api/ai/plan", payload), claudeOn(), fetcher);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.research.length, 1);
  assert.equal(result.research[0].url, "https://example.com/news");
  assert.equal(calls[0].url, "https://api.anthropic.com/v1/messages");
  assert.equal(calls[0].headers["x-api-key"], "test-claude-key");
  assert.equal(calls[0].body.model, "claude-haiku-4-5");
  assert.equal(calls[0].body.tools[0].type, "web_search_20250305");
  assert.equal(calls[1].body.tools, undefined);
});

test("Claude path: a paused search turn is resumed and an answer yields a follow-up", async () => {
  let n = 0;
  const bodies = [];
  const fetcher = async (_url, options) => {
    bodies.push(JSON.parse(options.body));
    n += 1;
    if (n === 1) return Response.json({ stop_reason: "pause_turn", content: [{ type: "text", text: "partial " }] });
    return claudeResponse(JSON.stringify({ proposal: "Built an editorial program with Sales and Operations.", followUp: null }));
  };
  const response = await handleCareerAI(req("/api/ai/follow-up", { role: "Director", question: { prompt: "What did you build?" }, answer: "I built an editorial program with Sales and Operations." }), claudeOn(), fetcher);
  const result = await response.json();
  assert.equal(result.proposal, "Built an editorial program with Sales and Operations.");
  assert.equal(n, 2);
  assert.equal(bodies[1].messages.at(-1).role, "assistant");
});

test("Claude path: busy, bad JSON and cut-off answers become plain messages", async () => {
  const send = (fetcher) => handleCareerAI(req("/api/ai/follow-up", { question: { prompt: "q" }, answer: "a" }), claudeOn(), fetcher);
  const busy = await send(async () => new Response("{}", { status: 529 }));
  assert.match((await busy.json()).error, /busy/);
  const bad = await send(async () => claudeResponse("not json at all"));
  assert.match((await bad.json()).error, /unreadable/);
  const cut = await send(async () => Response.json({ stop_reason: "max_tokens", content: [{ type: "text", text: "{" }] }));
  assert.match((await cut.json()).error, /interrupted/);
});

test("ANTHROPIC_BASE_URL redirects Claude calls to a gateway", async () => {
  let seen = "";
  const fetcher = async (url) => { seen = String(url); return claudeResponse(JSON.stringify({ proposal: "Did a thing.", followUp: null })); };
  await handleCareerAI(req("/api/ai/follow-up", { question: { prompt: "q" }, answer: "a" }), claudeOn({ ANTHROPIC_BASE_URL: "http://127.0.0.1:8789/" }), fetcher);
  assert.equal(seen, "http://127.0.0.1:8789/v1/messages");
});

test("an AI line that confesses a gap never reaches the resume", async () => {
  const send = (proposal) => handleCareerAI(req("/api/ai/follow-up", { question: { prompt: "q" }, answer: "I coordinated launches but did not own sales enablement." }), claudeOn(), async () => claudeResponse(JSON.stringify({ proposal, followUp: null })));
  const bad = await send("Coordinated launches, though sales enablement is a development area for the role.");
  assert.equal(bad.status, 422);
  assert.match((await bad.json()).error, /No supported resume wording/);
  const fine = await send("Coordinated six feature launches with sales and product.");
  assert.equal((await fine.json()).proposal, "Coordinated six feature launches with sales and product.");
});

test("the wording prompt forbids gap confessions", async () => {
  let system = "";
  await handleCareerAI(req("/api/ai/follow-up", { question: { prompt: "q" }, answer: "a" }), claudeOn(), async (_u, options) => { system = JSON.parse(options.body).system; return claudeResponse(JSON.stringify({ proposal: "Did a thing.", followUp: null })); });
  assert.match(system, /Never put a gap, weakness or learning need into the line/);
});

// ---- Tailor to the job ----
const tailorBody = { role: "Growth Lead", company: "Fernlight", summary: "Marketing manager with nine years in B2B SaaS.", header: "Senior Marketing Manager, Brightwave (2021 - Present)", bullets: ["Built the weekly Looker dashboard.", "Cut cost per lead 22% by moving budget to intent-based channels.", "Launched an onboarding email series that lifted trial-to-paid conversion from 14% to 17%."], skills: "Paid search, HubSpot, Looker", answers: ["I own about $600,000 a year of paid search budget."], priorities: ["paid acquisition", "lifecycle email"] };
const tailorWith = (out) => handleCareerAI(req("/api/ai/tailor", tailorBody), claudeOn(), async () => claudeResponse(JSON.stringify(out)));
const goodTailor = { summary: "Marketing manager with nine years in B2B SaaS who cut cost per lead 22%.", currentBullets: [{ id: 2, text: "Cut cost per lead 22% by moving budget to intent-based channels." }, { id: 3, text: "Launched an onboarding email series that lifted trial-to-paid conversion from 14% to 17%." }, { id: 1, text: "Built the weekly Looker dashboard." }], skills: "Paid search, Looker, HubSpot", why: ["Put cost per lead first because the role owns paid acquisition."] };

test("tailor: a faithful reorder comes back with the header kept first", async () => {
  const response = await tailorWith(goodTailor);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.currentLines[0], tailorBody.header);
  assert.equal(result.currentLines.length, 4);
  assert.match(result.currentLines[1], /cost per lead/);
  assert.equal(result.skills, "Paid search, Looker, HubSpot");
});

test("tailor: an invented figure, a missing bullet, or a gap confession is refused whole", async () => {
  const invented = await tailorWith({ ...goodTailor, summary: "Marketing manager who grew pipeline 300%." });
  assert.equal(invented.status, 422);
  assert.match((await invented.json()).error, /figure that is not in your material/);
  const dropped = await tailorWith({ ...goodTailor, currentBullets: goodTailor.currentBullets.slice(0, 2) });
  const doubled = await tailorWith({ ...goodTailor, currentBullets: [goodTailor.currentBullets[0], goodTailor.currentBullets[0], goodTailor.currentBullets[2]] });
  assert.match((await doubled.json()).error, /incomplete/);
  assert.match((await dropped.json()).error, /incomplete/);
  const confess = await tailorWith({ ...goodTailor, summary: "Marketing manager who lacks paid social experience." });
  assert.match((await confess.json()).error, /gaps/);
});

test("tailor: dropped skills fall back to the original list", async () => {
  const result = await (await tailorWith({ ...goodTailor, skills: "Paid search" })).json();
  assert.equal(result.skills, tailorBody.skills);
});

test("tailor: a bad request spends nothing", async () => {
  const response = await handleCareerAI(req("/api/ai/tailor", { role: "x", skills: "y", bullets: [] }), claudeOn(), async () => { throw new Error("no network"); });
  assert.equal(response.status, 422);
});

test("tailor: new skills, a bigger title, or talk of readiness to learn are all refused", async () => {
  const addedSkill = await (await tailorWith({ ...goodTailor, skills: "Paid search, Looker, HubSpot, Budget management" })).json();
  assert.equal(addedSkill.skills, tailorBody.skills);
  const inflated = await tailorWith({ ...goodTailor, summary: "Marketing leader with nine years in B2B SaaS." });
  assert.match((await inflated.json()).error, /called you a "leader"/);
  const plan = await tailorWith({ ...goodTailor, summary: "Marketer with nine years in B2B SaaS, ready to deepen product expertise." });
  assert.match((await plan.json()).error, /gaps or plans/);
});

test("wording: a plan or a hypothetical never becomes a resume line", async () => {
  const send = (proposal) => handleCareerAI(req("/api/ai/follow-up", { question: { prompt: "How would you approach it?" }, answer: "I would run customer interviews." }), claudeOn(), async () => claudeResponse(JSON.stringify({ proposal, followUp: null })));
  assert.equal((await send("I would approach the launch with customer interviews.")).status, 422);
  assert.equal((await send("Acknowledged a gap in pricing and committed to learning.")).status, 422);
  assert.equal((await send("Ran 12 customer interviews a year.")).status, 200);
});

test("wording: a line full of words the answer never used is refused, and a faithful one passes", async () => {
  const answer = "I designed and launched the onboarding email series at Brightwave. Trial-to-paid conversion went from 14% to 17% over two quarters, and I ran the A/B tests on subject lines and timing.";
  const send = (proposal) => handleCareerAI(req("/api/ai/follow-up", { question: { prompt: "What happened?" }, answer }), claudeOn(), async () => claudeResponse(JSON.stringify({ proposal, followUp: null })));
  const invented = await send("Lifted conversion from 14% to 17% through A/B testing; isolated email as primary driver via sequential testing with control groups across concurrent product changes.");
  assert.equal(invented.status, 422);
  const fine = await send("Designed and launched the onboarding email series at Brightwave, lifting trial-to-paid conversion from 14% to 17% over two quarters with A/B tests on subject lines and timing.");
  assert.equal(fine.status, 200);
});

test("tailor: a first answer that drops a line is retried once", async () => {
  let calls = 0;
  const fetcher = async () => { calls += 1; return claudeResponse(JSON.stringify(calls === 1 ? { ...goodTailor, currentBullets: goodTailor.currentBullets.slice(0, 2) } : goodTailor)); };
  const response = await handleCareerAI(req("/api/ai/tailor", tailorBody), claudeOn(), fetcher);
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
});
