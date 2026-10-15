// The concierge brain: pure functions over a snapshot of app state.
//
// The concierge IS the product now. It is a master delegator that is always
// on, tells the user what it just did, names the ONE next step, and asks the
// single highest-value question when one is needed. It never drives from a
// tab bar, never dumps a questionnaire, and never changes the resume itself:
// every doc change goes through the existing proposal/approval flow.
//
// Nothing here touches React, the network, or the doc. The UI is a thin shell
// over these functions, so the whole behaviour is unit-testable. The doc is
// treated as read-only: drafting a proposal returns a proposal object, and the
// caller only applies it through Approve.

import { draftChatProposal } from "./chat.js";
import { unsupportedNumbers } from "../../shared/claims.mjs";

export const CONCIERGE_AI_OFF_MESSAGE =
  "AI is off for this session, so I work from what you already gave me. Turn AI on and I can research, challenge the draft, and ask sharper questions — your choice, one click.";

export const CONCIERGE_GREETING_INTAKE =
  "I'm your Career Chief. Bring what you have — your resume and the job you want — and I'll do the digging, then ask only the questions that matter. Nothing lands on your resume without your approval.";

export const CONCIERGE_GREETING_RETURNING =
  "Welcome back. Your draft is still here. I'll pick up where you left off — one step at a time.";

// ---------------------------------------------------------------------------
// Stage: what the concierge is doing right now. Exactly one stage at a time.
// ---------------------------------------------------------------------------

export function conciergeStage(state = {}) {
  if (state.modal === "proposal") return "review";
  if (state.modal === "finish") return "finish";
  if (typeof state.busy === "string" && state.busy.startsWith("Researching")) return "analyzing";
  if (state.screen === "intake") return "intake";
  if (state.screen === "analysis") return "briefing";
  if (state.screen === "workspace") {
    if (state.justExported) return "done";
    const remaining = (state.questions || []).filter(
      (q) => state.questionStatus?.[q.id] !== "answered" && state.questionStatus?.[q.id] !== "skipped",
    );
    return remaining.length ? "interview" : "finish";
  }
  return "intake";
}

// ---------------------------------------------------------------------------
// Focus: EXACTLY ONE element highlighted at a time — the next thing the user
// must give us or answer. Returns a data-focus id, or null when nothing needs
// the user's hand right now. The App applies it to a single element.
// ---------------------------------------------------------------------------

export function conciergeFocus(state = {}) {
  const stage = conciergeStage(state);
  if (stage === "intake") {
    if (!state.hasResume) return "resume-input";
    if (!state.hasRole) return "role-input";
    if (!state.hasJob) return "job-input";
    if (state.canBegin) return "analyze-button";
    return null;
  }
  if (stage === "briefing") return "open-case-button";
  if (stage === "interview") {
    // The dock input IS the answer box. If the user wandered to another view,
    // the way back is the chip, not the input.
    return state.view === "interview" ? "concierge-input" : "back-to-question";
  }
  if (stage === "review") return "approve-button";
  if (stage === "finish") return state.modal === "finish" ? "export-word" : "finish-button";
  return null;
}

// ---------------------------------------------------------------------------
// Readiness: a progress number plus the four buckets from the vision file.
// The user should feel "I'm almost done", not "AI wants my whole life story".
// ---------------------------------------------------------------------------

export function conciergeReadiness(state = {}) {
  const questions = state.questions || [];
  const status = state.questionStatus || {};
  const answered = questions.filter((q) => status[q.id] === "answered").length;
  const skipped = questions.filter((q) => status[q.id] === "skipped").length;
  const remaining = questions.length - answered - skipped;

  let pct = 0;
  if (state.hasResume) pct += 10;
  if (state.hasRole) pct += 5;
  if (state.hasJob) pct += 10;
  if (state.analysis) {
    pct += 25;
    if (questions.length) pct += Math.round(30 * (answered / questions.length));
    else pct += 30;
    if (state.doc && (state.ledger?.attention?.length || 0) === 0) pct += 10;
    if (state.tailored) pct += 10;
  }
  pct = Math.max(0, Math.min(100, pct));

  const strong = (state.analysis?.known || []).slice(0, 3);
  const needClarity = (state.analysis?.gaps || []).slice(0, 3);
  const current = nextQuestion(questions, status);
  const worthFinding = current?.tip
    ? [{ label: current.topic, search: evidenceSearchFor(current) }]
    : [];
  const notImportant = skipped
    ? [`${skipped} question${skipped === 1 ? "" : "s"} skipped — they don't block anything.`]
    : [];

  return { pct, strong, needClarity, worthFinding, notImportant, answered, remaining, total: questions.length };
}

// ---------------------------------------------------------------------------
// Questions: the plan is already value-ordered. The concierge asks the first
// one that is neither answered nor skipped — one at a time, never a list.
// ---------------------------------------------------------------------------

export function nextQuestion(questions = [], questionStatus = {}) {
  return (
    (questions || []).find(
      (q) => questionStatus?.[q.id] !== "answered" && questionStatus?.[q.id] !== "skipped",
    ) || null
  );
}

// ---------------------------------------------------------------------------
// Challenges: what the concierge would flag in the draft. Local, honest,
// phrased as questions — never a verdict, never an invented claim.
// ---------------------------------------------------------------------------

const WEAK_OPENERS = [
  [/^responsible for\b/i, "starts with “Responsible for” — what did you actually own?"],
  [/^worked on\b/i, "starts with “Worked on” — what did you deliver?"],
  [/^(helped|assisted)(\s+with)?\b/i, "starts with a helper verb — what was your part?"],
  [/^in charge of\b/i, "starts with “In charge of” — what did you run?"],
  [/^(various|multiple|several)\b/i, "starts vague — which ones, specifically?"],
  [/\bvarious\b/i, "says “various” — which ones, specifically?"],
  [/\bmultiple\b/i, "says “multiple” — how many, or which ones?"],
  [/\bhelped\b/i, "says “helped” — what was your part?"],
];

const docLines = (doc = {}) => {
  const out = [];
  if (doc.summary?.trim()) out.push({ kind: "summary", label: "Summary", text: doc.summary.trim() });
  (doc.roles || []).forEach((role, roleIndex) => {
    (role.bullets || []).forEach((bullet, bulletIndex) => {
      if (String(bullet || "").trim()) {
        out.push({
          kind: "bullet",
          roleIndex,
          bulletIndex,
          label: `${[role.title, role.company].filter(Boolean).join(", ") || "Experience"} · bullet ${bulletIndex + 1}`,
          text: String(bullet).trim(),
        });
      }
    });
  });
  (doc.highlights || []).forEach((line, index) => {
    if (String(line || "").trim()) out.push({ kind: "highlight", index, label: `New lines · line ${index + 1}`, text: String(line).trim() });
  });
  return out;
};

export function challengeLines(doc = {}, supports = []) {
  const found = [];
  for (const line of docLines(doc)) {
    for (const [pattern, hint] of WEAK_OPENERS) {
      if (pattern.test(line.text)) {
        found.push({ ...line, kind: "generic", hint });
        break;
      }
    }
    if (found.length >= 3) break;
  }
  if (found.length < 3) {
    for (const line of docLines(doc)) {
      if (found.some((item) => item.text === line.text)) continue;
      const stray = unsupportedNumbers(line.text, supports);
      if (stray.length) {
        found.push({ ...line, kind: "unsupported", hint: `uses figure${stray.length === 1 ? "" : "s"} ${stray.join(", ")} that appear${stray.length === 1 ? "s" : ""} nowhere in your material — confirm or remove ${stray.length === 1 ? "it" : "them"}.` });
      }
      if (found.length >= 3) break;
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Evidence hunting: when proof is worth finding, name the EXACT search.
// Never sends the user searching aimlessly.
// ---------------------------------------------------------------------------

export function evidenceSearchFor(question) {
  if (!question) return null;
  return {
    query: question.topic,
    lookingFor: question.tip || "Rough notes are enough.",
    where: "your email, documents, or notes",
  };
}

// ---------------------------------------------------------------------------
// Messages the concierge posts at stage transitions.
// ---------------------------------------------------------------------------

export function baselineMessage(analysis = {}) {
  const first = (analysis.questions || [])[0];
  const unknown = (analysis.gaps || [])[0];
  const text = [
    `I read everything together. Strongest fit: ${analysis.strongestFit || "your career evidence"}.`,
    unknown ? `Biggest unknown: ${unknown.toLowerCase()}.` : "",
    first ? `First question: ${first.prompt}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return {
    text,
    actions: first ? [{ label: "Start with that question", action: "start-interview" }] : [],
  };
}

export function questionMessage(question) {
  if (!question) return null;
  return {
    text: `One question: ${question.prompt}`,
    actions: [
      { label: "I don't know yet", action: "help" },
      { label: "Skip for now", action: "skip" },
    ],
  };
}

export function nextStepText(state = {}) {
  const stage = conciergeStage(state);
  if (stage === "intake") {
    if (!state.hasResume) return "Next: paste or upload your resume.";
    if (!state.hasRole) return "Next: name the role you want.";
    if (!state.hasJob) return "Next: paste the job posting.";
    if (state.canBegin) return "Next: press Analyze — I'll do the homework first.";
    return "Next: add your resume, the role, and the job.";
  }
  if (stage === "analyzing") return "I'm reading everything together…";
  if (stage === "briefing") return "Next: open your hiring case.";
  if (stage === "interview") {
    const q = nextQuestion(state.questions || [], state.questionStatus || {});
    return q ? `Next: answer one question — ${q.topic}.` : "Next: review what changed.";
  }
  if (stage === "review") return "Next: approve or reject the proposed change.";
  if (stage === "finish") return "Next: finish your resume — exports are ready when you are.";
  if (stage === "done") return "Done. Your resume is exported.";
  return "Next: tell me what you're working on.";
}

// ---------------------------------------------------------------------------
// Quick-action chips for the dock, per stage. One obvious action per screen.
// ---------------------------------------------------------------------------

export function quickActions(state = {}) {
  const stage = conciergeStage(state);
  if (stage === "intake") return [{ label: "Load the sample", action: "sample" }];
  if (stage === "briefing") return [{ label: "Open my hiring case", action: "open-case" }];
  if (stage === "interview") {
    const actions = [
      { label: "Skip for now", action: "skip" },
      { label: "I don't know yet", action: "help" },
    ];
    if (state.view !== "interview") actions.unshift({ label: "Back to the question", action: "back-to-question" });
    else actions.push({ label: "See my sources", action: "sources" });
    if (state.doc) actions.push({ label: "Finish my resume now", action: "finish" });
    return actions;
  }
  if (stage === "finish") {
    return [
      { label: "Tailor it to the job", action: "tailor" },
      { label: "Back to the questions", action: "back-to-question" },
    ];
  }
  if (stage === "done") return [{ label: "Apply for another job", action: "new-opportunity" }];
  return [];
}

// ---------------------------------------------------------------------------
// Local concierge replies (AI off, or AI call failed). The concierge never
// pretends to know something it doesn't: freeform text it can't act on gets
// an honest pointer to what it CAN do, plus the next step.
// ---------------------------------------------------------------------------

const COMMANDS = [
  { test: /\b(finish|export|download|done with (this|questions?))\b/i, command: "finish" },
  { test: /\bskip\b/i, command: "skip" },
  { test: /\bwhat('s| is)? (next|the next step)|what (now|do i do)|where (am|are) (i|we)\b/i, command: "next" },
  { test: /\b(sources?|evidence|documents?|what (did )?i (give|upload|add))\b/i, command: "sources" },
  { test: /\bcompare\b|\bother jobs?\b|\banother job\b/i, command: "compare" },
  { test: /\bcareer (evidence|bank|record)\b|\bmy (career|record)\b/i, command: "career" },
  { test: /\btailor\b/i, command: "tailor" },
  { test: /\badd (context|a? ?source|a? ?document|a? ?file)\b/i, command: "add-source" },
  { test: /\b(back|hiring case|my case|the case)\b/i, command: "case" },
  { test: /\b(help|stuck|don'?t know|i don'?t know yet)\b/i, command: "help" },
  { test: /\b(new (opportunity|job|application)|different (job|company))\b/i, command: "new-opportunity" },
];

const EDIT_INTENT = /\b(stronger|punchier|sharper|strengthen|improve|better|rewrite|reword|tighten|shorter|plainer|clearer|lean (into|on)|emphasi[sz]e|focus on|highlight|play up|^add\b|actually\b|make (it|this|my)|change (it|this|my))\b/i;

/**
 * Handle one user message locally.
 * state: { doc, supports, stage, ... } — supports are the evidence texts a
 * figure may legitimately come from. Returns:
 *   { kind: "reply", text, actions? } — just talk
 *   { kind: "command", command } — the App performs the command
 *   { kind: "proposal", proposal } — open the approval dialog; doc untouched
 *   { kind: "answer" } — in interview stage, the App treats it as the answer
 */
export function localConciergeReply(state = {}, text = "") {
  const clean = String(text || "").trim();
  if (!clean) return { kind: "reply", text: "Say a bit more — for example, “make my first bullet stronger” or “actually, I led that project.”" };

  for (const { test, command } of COMMANDS) {
    if (test.test(clean)) return { kind: "command", command };
  }

  // In the interview, a statement is the answer — unless it is an edit
  // command, which still routes to a proposal. A question (ends in "?") is
  // addressed TO the concierge, not an answer: the App routes it to the AI
  // concierge, and the local brain below answers what it can from context.
  if (conciergeStage(state) === "interview" && !EDIT_INTENT.test(clean) && !clean.endsWith("?")) {
    return { kind: "answer" };
  }

  // Questions for the concierge, answered locally from what we already know.
  // No AI needed for these, and never an invented answer.
  if (clean.endsWith("?")) {
    if (/\b(strongest|best) fit\b/i.test(clean) && state.analysis) {
      return { kind: "reply", text: `Strongest fit so far: ${state.analysis.strongestFit || "your career evidence"}. ${state.analysis.thesis || ""}`.trim() };
    }
    if (/\b(gaps?|missing|unknown|unclear)\b/i.test(clean) && state.analysis?.gaps?.length) {
      return { kind: "reply", text: `Still unclear: ${state.analysis.gaps.slice(0, 3).join(", ")}. The next question targets the first of those.` };
    }
    if (/\b(how (far|much|close)|progress|ready|%|percent)\b/i.test(clean)) {
      const r = conciergeReadiness(state);
      return { kind: "reply", text: `You're ${r.pct}% ready. ${r.remaining} question${r.remaining === 1 ? "" : "s"} left. ${nextStepText(state)}` };
    }
    if (conciergeStage(state) === "interview") {
      const q = nextQuestion(state.questions || [], state.questionStatus || {});
      return { kind: "reply", text: `Good question — with AI off I can only work from what you gave me. The pending question is still: ${q ? q.prompt : "none — you're done with questions."}` };
    }
  }

  // Edit commands become proposals through the same drafting + approval flow
  // as the interview. Drafting never touches the doc.
  if (EDIT_INTENT.test(clean) && state.doc) {
    const drafted = draftChatProposal(state.doc, clean, state.supports || []);
    if (drafted && drafted.status === "proposal") {
      return { kind: "proposal", proposal: { ...drafted, text: drafted.proposed } };
    }
    if (drafted?.status === "gap") {
      return { kind: "reply", text: "That sounds like something you haven't done, so I won't put it on the resume. Tell me what you did do instead and I'll propose that wording." };
    }
    return { kind: "reply", text: "Say a bit more — for example, “make my first bullet stronger” or “actually, I led that project.”" };
  }

  if (!state.aiConsent) {
    return {
      kind: "reply",
      text: `${CONCIERGE_AI_OFF_MESSAGE} Right now I can still take edit requests (“make my first bullet stronger”), walk you through the next step, and open anything — sources, compare, finish. ${nextStepText(state)}`,
    };
  }

  return {
    kind: "reply",
    text: `I can take edit requests (“make my first bullet stronger”), walk you through the next step, open your sources or comparisons, or finish your resume. ${nextStepText(state)}`,
  };
}

// The input placeholder follows the stage, so the box itself teaches the flow.
export function conciergePlaceholder(state = {}) {
  const stage = conciergeStage(state);
  if (stage === "intake") return "Ask me anything, or fill in the highlighted box…";
  if (stage === "analyzing") return "I'm working — one moment…";
  if (stage === "briefing") return "Ask about your hiring case…";
  if (stage === "interview") return "Answer in your own words…";
  if (stage === "review") return "The proposal above is waiting for your approval…";
  return "Ask me anything…";
}
