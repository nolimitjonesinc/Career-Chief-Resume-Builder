import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import {
  applyChatProposal,
  chatAllowed,
  CHAT_AI_OFF_MESSAGE,
  draftChatProposal,
  findChatTarget,
  focusOf,
  strengthenLine,
  weaveFocus,
} from "../src/lib/chat.js";
import { unsupportedNumbers } from "../shared/claims.mjs";

const doc = {
  name: "Jordan Avery",
  summary: "Brand marketing leader with experience in content and community.",
  roles: [
    { title: "Senior Brand Marketing Manager", company: "Rivermark Health", dates: "2021–present", bullets: ["Responsible for brand positioning and customer education.", "Worked on agency partnerships."] },
    { title: "Brand Marketing Manager", company: "Lume Collective", dates: "2018–2021", bullets: ["Developed brand strategy for consumer clients."] },
  ],
  highlights: [],
  education: [],
  skills: ["Leadership", "Storytelling"],
};
const snapshot = () => JSON.parse(JSON.stringify(doc));

// ── Consent gate ──────────────────────────────────────────────────────────

test("chat is blocked without AI consent, allowed with it", () => {
  assert.equal(chatAllowed(false), false);
  assert.equal(chatAllowed(undefined), false);
  assert.equal(chatAllowed(true), true);
  assert.match(CHAT_AI_OFF_MESSAGE, /Turn AI on/i);
});

// ── Drafting never touches the doc ─────────────────────────────────────────

test("a chat request produces a proposal, NOT a direct doc change", () => {
  const before = snapshot();
  const proposal = draftChatProposal(doc, "make this bullet stronger", []);
  assert.equal(proposal.status, "proposal");
  assert.ok(proposal.proposed.length > 0);
  assert.deepEqual(doc, before); // drafting is pure
});

test("rejection means simply not applying: the doc is unchanged", () => {
  const before = snapshot();
  draftChatProposal(doc, "make this bullet stronger", []);
  // No apply call — the rejection path.
  assert.deepEqual(doc, before);
});

// ── Approval lands the change ──────────────────────────────────────────────

test("approval lands a strengthened bullet in place", () => {
  const proposal = draftChatProposal(doc, "make my first bullet stronger", []);
  assert.equal(proposal.target.kind, "bullet");
  assert.equal(proposal.target.bulletIndex, 0);
  const next = applyChatProposal(doc, proposal);
  assert.notEqual(next.roles[0].bullets[0], doc.roles[0].bullets[0]);
  assert.match(next.roles[0].bullets[0], /^Owned brand positioning/);
  assert.equal(next.roles[0].bullets[1], doc.roles[0].bullets[1]); // others untouched
  assert.deepEqual(doc, snapshot()); // apply never mutates the input
});

test("strengthenLine only reframes weak openers, keeps the facts", () => {
  assert.equal(strengthenLine("Responsible for brand positioning."), "Owned brand positioning.");
  assert.equal(strengthenLine("Worked on agency partnerships."), "Delivered agency partnerships.");
  assert.equal(strengthenLine("Developed brand strategy for consumer clients."), "Developed brand strategy for consumer clients.");
});

test("lean into X weaves the user's focus into the matching line", () => {
  assert.equal(focusOf("lean into the launch, the company cares about it"), "launch");
  const proposal = draftChatProposal(doc, "lean into customer education, the company cares about it", []);
  assert.equal(proposal.target.kind, "bullet");
  assert.match(proposal.proposed, /customer education/);
  const next = applyChatProposal(doc, proposal);
  assert.ok(next.roles[0].bullets.some((line) => /emphasizing customer education/.test(line) || /customer education/.test(line)));
});

test("weaveFocus leaves a line alone when it already carries the focus", () => {
  const line = "Led customer education programs.";
  assert.equal(weaveFocus(line, "customer education"), line);
});

test("actually I led that project replaces the matching line with the user's words", () => {
  const proposal = draftChatProposal(doc, "actually I led that project", []);
  assert.match(proposal.proposed, /^Led that project\./);
  assert.equal(proposal.evidence, "user");
});

test("add a bullet becomes a new line, not a rewrite", () => {
  const proposal = draftChatProposal(doc, "add a bullet about mentoring interns", []);
  assert.equal(proposal.target.kind, "new");
  const next = applyChatProposal(doc, proposal);
  assert.equal(next.highlights.length, 1);
  assert.match(next.highlights[0], /mentor/i);
  assert.deepEqual(next.roles, doc.roles); // no existing line rewritten
});

test("an unmatched freeform request becomes a new line in the user's words", () => {
  const proposal = draftChatProposal(doc, "I built a creator program from scratch", []);
  assert.equal(proposal.target.kind, "new");
  assert.match(proposal.proposed, /creator program/i);
});

test("summary and skills are addressable targets", () => {
  const summary = draftChatProposal(doc, "make my summary stronger", []);
  assert.equal(summary.target.kind, "summary");
  const applied = applyChatProposal(doc, { ...summary, proposed: "New summary." });
  assert.equal(applied.summary, "New summary.");
  const skill = draftChatProposal(doc, "make my storytelling skill stronger", []);
  assert.equal(skill.target.kind, "skill");
});

// ── Evidence discipline ─────────────────────────────────────────────────────

test("a user-stated figure in the request passes the trust check", () => {
  const proposal = draftChatProposal(doc, "add a bullet: I grew signups 35% in one quarter", []);
  assert.deepEqual(proposal.unsupportedNumbers, []);
  assert.match(proposal.proposed, /35%/);
});

test("a drafted proposal never invents a figure absent from doc + request", () => {
  const supports = [doc.summary, ...doc.roles.flatMap((role) => role.bullets)];
  for (const request of [
    "make this bullet stronger",
    "lean into customer education",
    "actually I led that project",
    "add a bullet about mentoring interns",
    "rewrite my summary to be punchier",
  ]) {
    const proposal = draftChatProposal(doc, request, supports);
    assert.deepEqual(proposal.unsupportedNumbers, [], request);
    assert.deepEqual(unsupportedNumbers(proposal.proposed, [...supports, request]), [], request);
  }
});

test("gap confessions produce no proposal", () => {
  const proposal = draftChatProposal(doc, "I haven't done that", []);
  assert.equal(proposal.status, "gap");
  const plan = draftChatProposal(doc, "I would approach it by running interviews", []);
  assert.equal(plan.status, "gap");
});

test("too-short requests produce no proposal", () => {
  assert.equal(draftChatProposal(doc, " ", []), null);
});

test("findChatTarget matches by keywords, not position alone", () => {
  const target = findChatTarget(doc, "make the agency partnerships bullet stronger");
  assert.equal(target.original, "Worked on agency partnerships.");
});

// ── App wiring guards (static: no browser harness in this repo) ────────────

const appSrc = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("App has a persistent concierge dock instead of a Chat tab", () => {
  // The tab is gone: the concierge IS the chat, pinned to the bottom of every
  // screen. No tab entry, no ChatTab render.
  assert.doesNotMatch(appSrc, /\['chat','Chat'\]/);
  assert.doesNotMatch(appSrc, /tab === "chat" && <ChatTab/);
  assert.match(appSrc, /<ConciergeDock/);
  assert.match(appSrc, /from "\.\/components\/Concierge"/);
  assert.match(appSrc, /import "\.\/components\/concierge\.css"/);
});

test("chat proposals reuse the interview approval modal, not a second system", () => {
  assert.match(appSrc, /modal === "proposal" && \(currentQuestion \|\| chatProposal\)/);
  assert.match(appSrc, /chat=\{Boolean\(chatProposal\)\}/);
  assert.doesNotMatch(appSrc, /chat-proposal-modal|ChatApproval|second approval/);
  // Approve lands via the shared apply path; Reject and dialog-close discard.
  assert.match(appSrc, /apply=\{chatProposal \? applyChatProposal : applyProposal\}/);
  assert.match(appSrc, /onReject=\{chatProposal \? rejectChatProposal : undefined\}/);
  assert.match(appSrc, /onCancel=\{closeDialog\}/);
});

test("concierge never writes the doc except through the Approve path", () => {
  // The only doc-writing call for concierge proposals is inside applyChatProposal.
  const applyBody = appSrc.slice(appSrc.indexOf("function applyChatProposal()"), appSrc.indexOf("function rejectChatProposal()"));
  assert.match(applyBody, /applyChatProposalToDoc/);
  assert.match(applyBody, /setDoc/);
  // sendConcierge drafts and opens the modal; it must not call setDoc.
  const sendBody = appSrc.slice(appSrc.indexOf("async function sendConcierge()"), appSrc.indexOf("function applyChatProposal()"));
  assert.ok(sendBody.length > 0, "sendConcierge not found");
  assert.doesNotMatch(sendBody, /setDoc/);
});

test("chat messages and consent are never persisted (Rule 8 + session-only chat)", () => {
  const save = appSrc.match(/localStorage\.setItem\(storageKey, JSON\.stringify\(\{[^}]+\}\)\)/);
  assert.ok(save, "draft save statement not found");
  assert.doesNotMatch(save[0], /aiConsent|chatMessages|chatProposal/);
});

test("AI-off concierge shows a clear message with a one-click turn-on", () => {
  // The dock carries the AI toggle bound to the same session consent state;
  // the local brain explains AI is off instead of faking understanding.
  assert.match(appSrc, /<ConciergeDock/);
  assert.match(appSrc, /aiConsent=\{aiConsent\}/);
  assert.match(appSrc, /onToggleAi=\{setAiConsent\}/);
  const brainSrc = fs.readFileSync(new URL("../src/lib/concierge.js", import.meta.url), "utf8");
  assert.match(brainSrc, /CONCIERGE_AI_OFF_MESSAGE/);
  assert.match(brainSrc, /Turn AI on/);
});

test("concierge approval records the request as user evidence for the ledger", () => {
  const applyBody = appSrc.slice(appSrc.indexOf("function applyChatProposal()"), appSrc.indexOf("function rejectChatProposal()"));
  assert.match(applyBody, /setCareerBank/);
  assert.match(applyBody, /setAnswers/);
  assert.match(applyBody, /origin: "Concierge"/);
});
