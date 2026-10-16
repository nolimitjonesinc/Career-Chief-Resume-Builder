import assert from "node:assert/strict";
import test from "node:test";
import {
  baselineMessage,
  challengeLines,
  conciergeAiFailureMessage,
  conciergeFocus,
  conciergeReadiness,
  conciergeStage,
  evidenceSearchFor,
  localConciergeReply,
  nextQuestion,
  nextStepText,
  questionMessage,
  quickActions,
  conciergePlaceholder,
  CONCIERGE_AI_OFF_MESSAGE,
} from "../src/lib/concierge.js";

const doc = {
  name: "Jordan Avery",
  summary: "Brand marketing leader with experience in content and community.",
  roles: [
    { title: "Senior Brand Marketing Manager", company: "Rivermark Health", dates: "2021–present", bullets: ["Responsible for brand positioning and customer education.", "Worked on agency partnerships.", "Grew revenue 40% year over year."] },
    { title: "Brand Marketing Manager", company: "Lume Collective", dates: "2018–2021", bullets: ["Developed brand strategy for consumer clients."] },
  ],
  highlights: [],
  education: [],
  skills: ["Leadership", "Storytelling"],
};
const questions = [
  { id: "q1", priority: "Highest value", topic: "Program ownership", prompt: "What did you personally build?", why: "Ownership matters.", tip: "Think about strategy and process." },
  { id: "q2", priority: "High value", topic: "Outcomes", prompt: "What changed because of that program?", why: "Outcomes matter.", tip: "Use a supported result." },
];
const analysis = {
  thesis: "A brand leader who has begun building the content operation this role needs.",
  strongestFit: "Brand strategy + team leadership",
  caution: "Outcomes need checking.",
  known: ["Brand strategy", "Team leadership"],
  gaps: ["Measurable growth", "Creator program"],
  requirements: [{ label: "Creator program" }, { label: "Team leadership" }],
  questions,
  researchMode: "local",
};
const ledger = { attention: [] };
const base = {
  screen: "intake", view: "case", modal: null, busy: "",
  hasResume: false, hasRole: false, hasJob: false, canBegin: false,
  analysis: null, doc: null, questions: [], questionIndex: 0, questionStatus: {},
  answers: [], ledger: null, tailored: false, justExported: false,
  aiConsent: false, aiEnabled: false, supports: [],
};
const workspace = { ...base, screen: "workspace", hasResume: true, hasRole: true, hasJob: true, canBegin: true, analysis, doc, questions, ledger };

// ── Stage ───────────────────────────────────────────────────────────────────

test("stage follows the flow: intake → briefing → interview → finish → done", () => {
  assert.equal(conciergeStage(base), "intake");
  assert.equal(conciergeStage({ ...base, screen: "analysis", analysis }), "briefing");
  assert.equal(conciergeStage({ ...workspace, view: "interview" }), "interview");
  assert.equal(
    conciergeStage({ ...workspace, questionStatus: { q1: "answered", q2: "skipped" } }),
    "finish",
  );
  assert.equal(conciergeStage({ ...workspace, modal: "proposal" }), "review");
  assert.equal(conciergeStage({ ...workspace, modal: "finish" }), "finish");
  assert.equal(conciergeStage({ ...workspace, busy: "Researching the company…" }), "analyzing");
  assert.equal(conciergeStage({ ...workspace, justExported: true }), "done");
});

// ── Focus: exactly one target at a time ──────────────────────────────────────

test("focus is exactly one element, following the intake order", () => {
  assert.equal(conciergeFocus(base), "resume-input");
  assert.equal(conciergeFocus({ ...base, hasResume: true }), "role-input");
  assert.equal(conciergeFocus({ ...base, hasResume: true, hasRole: true }), "job-input");
  assert.equal(
    conciergeFocus({ ...base, hasResume: true, hasRole: true, hasJob: true, canBegin: true }),
    "analyze-button",
  );
  assert.equal(conciergeFocus({ ...base, screen: "analysis", analysis }), "open-case-button");
  assert.equal(conciergeFocus({ ...workspace, view: "interview" }), "concierge-input");
  // Wandered to another view: the way back is the chip, not the input.
  assert.equal(conciergeFocus({ ...workspace, view: "research" }), "back-to-question");
  assert.equal(conciergeFocus({ ...workspace, modal: "proposal" }), "approve-button");
  assert.equal(conciergeFocus({ ...workspace, modal: "finish" }), "export-word");
  assert.equal(
    conciergeFocus({ ...workspace, questionStatus: { q1: "answered", q2: "answered" } }),
    "finish-button",
  );
  assert.equal(conciergeFocus({ ...workspace, justExported: true }), null);
  // The return type is always one id or null — never a list.
  for (const state of [base, workspace, { ...workspace, modal: "proposal" }]) {
    const focus = conciergeFocus(state);
    assert.ok(focus === null || typeof focus === "string");
  }
});

// ── Readiness ───────────────────────────────────────────────────────────────

test("readiness starts at 0 and reaches 100 only when everything is done", () => {
  assert.equal(conciergeReadiness(base).pct, 0);
  const done = {
    ...workspace,
    questionStatus: { q1: "answered", q2: "answered" },
    tailored: true,
  };
  assert.equal(conciergeReadiness(done).pct, 100);
  const partial = { ...workspace, questionStatus: { q1: "answered" } };
  const mid = conciergeReadiness(partial).pct;
  assert.ok(mid > conciergeReadiness(workspace).pct, "answering a question raises readiness");
  assert.ok(mid < 100, "one answer is not done");
});

test("readiness buckets come from the analysis, not invented", () => {
  const r = conciergeReadiness(workspace);
  assert.deepEqual(r.strong, ["Brand strategy", "Team leadership"]);
  assert.deepEqual(r.needClarity, ["Measurable growth", "Creator program"]);
  assert.equal(r.worthFinding[0].label, "Program ownership");
  assert.equal(r.worthFinding[0].search.query, "Program ownership");
  assert.deepEqual(r.notImportant, []);
  const skipped = conciergeReadiness({ ...workspace, questionStatus: { q1: "skipped" } });
  assert.equal(skipped.notImportant.length, 1);
  assert.match(skipped.notImportant[0], /don't block/);
});

// ── Questions: one at a time ────────────────────────────────────────────────

test("next question skips answered and skipped, returns null when done", () => {
  assert.equal(nextQuestion(questions, {}).id, "q1");
  assert.equal(nextQuestion(questions, { q1: "answered" }).id, "q2");
  assert.equal(nextQuestion(questions, { q1: "skipped", q2: "answered" }), null);
});

test("baseline message names the fit, the unknown, and the first question topic — never the full prompt", () => {
  const m = baselineMessage(analysis);
  assert.match(m.text, /Brand strategy \+ team leadership/);
  assert.match(m.text, /measurable growth/);
  // Topic only: the full prompt lives solely in the question message the
  // interview posts. Repeating it here put the question on screen twice.
  assert.match(m.text, /Program ownership/);
  assert.ok(!m.text.includes("What did you personally build?"));
  // No "Start with that question" action: the hiring-case button is the
  // single way to start. A second start control duplicated it.
  assert.deepEqual(m.actions, []);
});

test("question message is the single home of the question, with help and skip", () => {
  const m = questionMessage(questions[0]);
  assert.match(m.text, /What did you personally build/);
  assert.deepEqual(m.actions.map((a) => a.action), ["help", "skip"]);
});

// ── Challenges ──────────────────────────────────────────────────────────────

test("challenge flags weak openers and unsupported figures, never clean lines", () => {
  const found = challengeLines(doc, ["Brand marketing leader with experience in content and community."]);
  assert.ok(found.some((item) => item.kind === "generic" && /Responsible for/.test(item.text)));
  assert.ok(found.some((item) => item.kind === "unsupported" && /40%/.test(item.text)));
  assert.ok(!found.some((item) => /Developed brand strategy/.test(item.text)));
  assert.ok(found.length <= 3, "at most three challenges at once");
});

test("evidence search names the exact thing to look for", () => {
  const search = evidenceSearchFor(questions[0]);
  assert.equal(search.query, "Program ownership");
  assert.equal(search.lookingFor, "Think about strategy and process.");
  assert.equal(evidenceSearchFor(null), null);
});

// ── Next step + quick actions ───────────────────────────────────────────────

test("next step is one plain sentence per stage", () => {
  assert.match(nextStepText(base), /paste or upload your resume/);
  assert.match(nextStepText({ ...base, screen: "analysis", analysis }), /open your hiring case/);
  assert.match(nextStepText({ ...workspace, view: "interview" }), /Program ownership/);
  assert.match(nextStepText({ ...workspace, modal: "proposal" }), /approve or reject/);
});

test("quick actions never duplicate what is already on screen", () => {
  // No Finish chip: Finish lives in the header + the dock's persistent button.
  // No Skip / I-don't-know chips: the current question card already has them.
  const interviewActions = quickActions({ ...workspace, view: "interview" }).map((a) => a.action);
  assert.ok(!interviewActions.includes("finish"), "no Finish chip");
  assert.ok(!interviewActions.includes("skip"), "no Skip chip duplicating the card");
  assert.ok(!interviewActions.includes("help"), "no Help chip duplicating the card");
  assert.deepEqual(interviewActions, ["sources"]);
  // Off the interview view, the only chip is the way back — still no Skip/Help/Finish.
  assert.deepEqual(
    quickActions({ ...workspace, view: "case" }).map((a) => a.action),
    ["back-to-question"],
  );
  // No sample chip: the intake pane already has the sample link.
  assert.deepEqual(quickActions(base), []);
  // No open-case chip: the analysis pane already has the Open button.
  assert.deepEqual(quickActions({ ...base, screen: "analysis", analysis }).map((a) => a.action), []);
});

test("the question prompt is produced exactly once", () => {
  // baselineMessage carries the topic, not the prompt; chips carry no prompt.
  const baseline = baselineMessage(analysis);
  assert.ok(!baseline.text.includes(questions[0].prompt));
  for (const state of [{ ...workspace, view: "interview" }, { ...workspace, view: "case" }]) {
    for (const a of quickActions(state)) {
      assert.ok(!a.label.includes(questions[0].prompt));
    }
  }
  // Only questionMessage carries the full prompt.
  assert.ok(questionMessage(questions[0]).text.includes(questions[0].prompt));
});

// ── Local replies ───────────────────────────────────────────────────────────

test("local commands route without the model", () => {
  assert.equal(localConciergeReply(workspace, "finish my resume").kind, "command");
  assert.equal(localConciergeReply(workspace, "finish my resume").command, "finish");
  assert.equal(localConciergeReply(workspace, "skip this").command, "skip");
  assert.equal(localConciergeReply(workspace, "what's next?").command, "next");
  assert.equal(localConciergeReply(workspace, "show me my sources").command, "sources");
});

test("an edit command becomes a proposal and never mutates the doc", () => {
  const deepFreeze = (value) => {
    if (value && typeof value === "object") { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
    return value;
  };
  const frozen = deepFreeze(JSON.parse(JSON.stringify(doc)));
  const state = { ...workspace, doc: frozen, supports: ["Brand marketing leader."] };
  const result = localConciergeReply(state, "make my first bullet stronger");
  assert.equal(result.kind, "proposal");
  assert.ok(result.proposal.proposed.length > 0);
  assert.equal(frozen.roles[0].bullets[0], "Responsible for brand positioning and customer education.");
});

test("a gap confession is a reply, not a resume line", () => {
  const finished = { ...workspace, questionStatus: { q1: "answered", q2: "answered" } };
  const result = localConciergeReply({ ...finished, doc }, "actually I haven't done that");
  assert.equal(result.kind, "reply");
  assert.match(result.text, /haven't done/);
});

test("in the interview, a statement is an answer and a question is not", () => {
  const state = { ...workspace, view: "interview" };
  assert.equal(localConciergeReply(state, "I built the creator program.").kind, "answer");
  const asked = localConciergeReply(state, "what's my strongest fit?");
  assert.equal(asked.kind, "reply");
  assert.match(asked.text, /Brand strategy \+ team leadership/);
});

test("AI-off freeform gets an honest pointer, never an invented answer", () => {
  const state = { ...workspace, view: "case", aiConsent: false, questionStatus: { q1: "answered", q2: "answered" } };
  const result = localConciergeReply(state, "tell me about my candidacy");
  assert.equal(result.kind, "reply");
  assert.match(result.text, /AI is off/);
  assert.ok(!/40%/.test(result.text));
  assert.match(CONCIERGE_AI_OFF_MESSAGE, /AI is off/);
});

test("placeholders follow the stage", () => {
  assert.match(conciergePlaceholder(base), /highlighted box/);
  assert.match(conciergePlaceholder({ ...workspace, view: "interview" }), /Answer in your own words/);
  assert.match(conciergePlaceholder({ ...workspace, modal: "proposal" }), /waiting for your approval/);
});

test("a failed AI call surfaces the server's real error in the dock", () => {
  const serverError = "AI research has reached today's limit. The transparent analysis still works; try AI again tomorrow.";
  const message = conciergeAiFailureMessage(new Error(serverError));
  assert.ok(message.startsWith("AI couldn't answer that: "), message);
  assert.ok(message.includes(serverError), message);
});

test("a failed AI call with no server message keeps the generic line", () => {
  assert.equal(
    conciergeAiFailureMessage(new Error("")),
    "AI couldn't answer that — here's what I can do from what you gave me.",
  );
  assert.equal(
    conciergeAiFailureMessage(undefined),
    "AI couldn't answer that — here's what I can do from what you gave me.",
  );
});

test("a network failure or unparseable body keeps the generic line", () => {
  const network = new TypeError("Failed to fetch");
  assert.equal(
    conciergeAiFailureMessage(network),
    "AI couldn't answer that — here's what I can do from what you gave me.",
  );
  const parse = new SyntaxError("Unexpected token '<'");
  assert.equal(
    conciergeAiFailureMessage(parse),
    "AI couldn't answer that — here's what I can do from what you gave me.",
  );
});

test("a surfaced server error is truncated to 300 chars", () => {
  const long = `x`.repeat(1000);
  const message = conciergeAiFailureMessage(new Error(long));
  assert.equal(message, `AI couldn't answer that: ${`x`.repeat(300)}`);
});
