// Chat mode (v1): freeform change requests → a proposed doc change that
// goes through the SAME approval modal as the interview. Nothing lands
// without approval: drafting a proposal never touches the doc — only
// applyChatProposal does, and the app only calls it from Approve.
//
// Evidence discipline: every proposed line is built ONLY from words the
// user already supplied — the current doc plus the chat request itself,
// which counts as user evidence. No new figures are ever introduced, and
// the proposal still runs through the trust layer (unsupportedNumbers)
// so any figure that somehow isn't in the doc or the request is flagged
// in the approval dialog instead of landing silently.
//
// Chat is gated by the session AI-consent toggle (Rule 8): when consent
// is off, the chat pane blocks sending and offers a one-click turn-on.
// Consent is never persisted — that behavior lives in App.jsx and is
// unchanged by this module.
//
// No multi-turn memory: the doc + evidence ledger are the memory. Chat
// messages themselves are session-only (never saved to the draft).
import { unsupportedNumbers } from "../../shared/claims.mjs";
import { looksLikeGap } from "../../shared/gaps.mjs";
import { proposeResumeUpdate } from "./analyze.js";

export const CHAT_AI_OFF_MESSAGE =
  "Chat needs AI on for this session. Turn AI on below and your request will stay here — nothing is sent anywhere until you do.";

// The consent gate. Chat sends nothing and drafts nothing without it.
export const chatAllowed = (aiConsent) => Boolean(aiConsent);

const STOP = new Set(
  "the and for with that this from have has had were was are our your their into over under about across through more most also will would could should using used per via within between each other than then them they what when where which while who make please bullet line summary stronger punchier sharper tighten shorter plainer rewrite reword improve better actually just".split(" "),
);
const wordsOf = (text) =>
  (String(text || "").toLowerCase().match(/[a-z0-9][a-z0-9'-]{3,}/g) || []).filter((word) => !STOP.has(word));

// Every editable line in the doc, as a proposal target.
function candidatesOf(doc) {
  const out = [];
  if (doc?.summary?.trim()) out.push({ kind: "summary", label: "Summary", original: doc.summary.trim() });
  (doc?.roles || []).forEach((role, roleIndex) => {
    (role.bullets || []).forEach((bullet, bulletIndex) => {
      if (!String(bullet || "").trim()) return;
      out.push({
        kind: "bullet",
        roleIndex,
        bulletIndex,
        label: `${[role.title, role.company].filter(Boolean).join(", ") || "Experience"} · bullet ${bulletIndex + 1}`,
        original: String(bullet).trim(),
      });
    });
  });
  (doc?.highlights || []).forEach((line, index) => {
    if (!String(line || "").trim()) return;
    out.push({ kind: "highlight", index, label: `New lines from your answers · line ${index + 1}`, original: String(line).trim() });
  });
  (doc?.skills || []).forEach((skill, index) => {
    if (!String(skill || "").trim()) return;
    out.push({ kind: "skill", index, label: `Capabilities · ${skill}`, original: String(skill).trim() });
  });
  return out;
}

// Best-matching line for a request, by shared keywords. Explicit cues win:
// "summary" → the summary, "skill" → capabilities, "first bullet" → the
// first bullet. Returns null when nothing matches (caller treats the
// request as a brand-new line instead of a rewrite).
export function findChatTarget(doc, request) {
  const text = String(request || "").toLowerCase();
  const candidates = candidatesOf(doc);
  if (!candidates.length) return null;
  if (/\bsummary\b/.test(text)) return candidates.find((item) => item.kind === "summary") || null;
  if (/\bskill|capabilit/i.test(text)) return candidates.find((item) => item.kind === "skill") || null;
  if (/\bfirst bullet\b/.test(text)) return candidates.find((item) => item.kind === "bullet") || null;
  if (/\blast bullet|latest bullet\b/.test(text)) return candidates.slice().reverse().find((item) => item.kind === "bullet") || null;
  const wanted = new Set(wordsOf(request));
  if (!wanted.size) return null;
  let best = null;
  for (const candidate of candidates) {
    const have = new Set(wordsOf(candidate.original));
    let score = 0;
    for (const word of wanted) if (have.has(word)) score += 1;
    // A shared two-word phrase beats scattered single words.
    const phrases = String(request).toLowerCase().match(/[a-z][a-z' -]{4,}/g) || [];
    for (const phrase of phrases) {
      const pair = phrase.trim().split(/\s+/).slice(0, 2).join(" ");
      if (pair.includes(" ") && candidate.original.toLowerCase().includes(pair)) score += 2;
    }
    if (score > 0 && (!best || score > best.score)) best = { ...candidate, score };
  }
  return best;
}

// "Responsible for X" → "Owned X": weak openers become action verbs. The
// facts stay exactly as written; only the framing gets stronger.
const WEAK_OPENERS = [
  [/^responsible for\s+/i, "Owned "],
  [/^was responsible for\s+/i, "Owned "],
  [/^worked on\s+/i, "Delivered "],
  [/^helped( with| to)?\s+/i, "Supported "],
  [/^assisted( with)?\s+/i, "Supported "],
  [/^in charge of\s+/i, "Ran "],
  [/^took part in\s+/i, "Contributed to "],
];
export function strengthenLine(line) {
  let text = String(line || "").trim().replace(/[.]+$/, "");
  for (const [pattern, replacement] of WEAK_OPENERS) {
    if (pattern.test(text)) { text = text.replace(pattern, replacement); break; }
  }
  text = text.replace(/\b(very|really)\s+/gi, "");
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

// Weave a user-named focus into an existing line ("lean into X, the
// company cares about it" → "..., emphasizing X."). X comes from the user,
// so it is user evidence, not an invented claim.
export function weaveFocus(line, focus) {
  const clean = String(focus || "").trim().replace(/[.]+$/, "");
  if (!clean) return String(line || "").trim();
  if (String(line || "").toLowerCase().includes(clean.toLowerCase())) return String(line).trim();
  return `${String(line).trim().replace(/[.]+$/, "")}, emphasizing ${clean}.`;
}

const FOCUS_AFTER = /(?:lean (?:into|on)|emphasi[sz]e|focus on|highlight|play up|lean into)\s+(?:the\s+|my\s+|our\s+)?/i;
export function focusOf(request) {
  const match = String(request || "").match(FOCUS_AFTER);
  if (!match) return "";
  const rest = String(request).slice(match.index + match[0].length);
  return rest
    .split(/,|;| because | and the company| that | which /i)[0]
    .replace(/^(the|my|our)\s+/i, "")
    .trim()
    .replace(/[.]+$/, "");
}

// The user's own words, cleaned into one resume-style line. Used for
// "add ..." requests and corrections ("actually I led that project").
function userLine(request) {
  const stripped = String(request || "")
    .replace(/^(please\s+)?(add|include|mention|put in)\s+(a\s+)?(bullet|line)?\s*(that\s+says?|about|saying)?\s*/i, "")
    .replace(/^(actually|correction:?)\s*/i, "")
    .replace(/^(make it say|it should say|say)\s*/i, "")
    .trim();
  return proposeResumeUpdate({}, { id: "chat" }, stripped || String(request || ""));
}

// Draft a proposal for a chat request. PURE: never mutates the doc.
// Returns { status: "proposal", target, original, proposed, request,
// evidence, unsupportedNumbers, note } — or { status: "gap" } when the
// request confesses something not done (nothing belongs on the resume),
// or null when the request is too short to act on.
export function draftChatProposal(doc, request, supports = []) {
  const text = String(request || "").trim();
  if (text.length < 2) return null;
  // "I haven't done that" is an honest answer, not a resume line — same
  // gap rule as the interview (shared/gaps.mjs).
  if (looksLikeGap(text)) return { status: "gap", request: text };

  const lower = text.toLowerCase();
  const docText = [
    doc?.summary || "",
    ...(doc?.roles || []).flatMap((role) => [role.title, role.company, ...(role.bullets || [])]),
    ...(doc?.highlights || []),
    ...(doc?.skills || []),
  ].join("\n");
  const evidenceTexts = [...supports, docText, text];

  const finish = (target, proposed, evidence, note) => {
    const figures = unsupportedNumbers(proposed, evidenceTexts);
    return {
      status: "proposal",
      target: target || { kind: "new", label: "New line from your answers" },
      original: target?.original || "",
      proposed: String(proposed || "").trim(),
      request: text,
      evidence,
      unsupportedNumbers: figures,
      note,
    };
  };

  // "Add ..." → a brand-new line from the user's own words.
  if (/^(please\s+)?(add|include|mention|put in)\b/i.test(text) || /\bnew bullet|another bullet\b/i.test(text)) {
    return finish(null, userLine(text), "user", "New line from what you just told me. It lands in your answers, not as a verified fact.");
  }
  // "Lean into X" → weave X into the best-matching line.
  if (FOCUS_AFTER.test(text)) {
    const focus = focusOf(text);
    const target = findChatTarget(doc, focus || text) || findChatTarget(doc, text);
    if (target && focus) {
      return finish(target, weaveFocus(target.original, focus), "reword",
        target.original.toLowerCase().includes(focus.toLowerCase())
          ? "That line already emphasizes this — nothing to change."
          : "Reworded from your existing line, with the focus you named.");
    }
    if (focus) return finish(null, userLine(`I emphasized ${focus}`), "user", "No existing line covers this yet, so it becomes a new line from your words.");
  }
  // "Actually I led that project" → the user's correction replaces the
  // best-matching line (or becomes a new line if nothing matches).
  if (/^actually\b/i.test(text) || /\b(i|we)\s+(led|ran|built|owned|managed|created|launched|designed|drove)\b/i.test(text)) {
    const target = findChatTarget(doc, text);
    const proposed = userLine(text);
    if (target) return finish(target, proposed, "user", "Your correction, in your words. The old wording is replaced only if you approve.");
    return finish(null, proposed, "user", "New line from what you just told me.");
  }
  // "Make this bullet stronger" / "rewrite ..." → strengthen the match.
  if (/\b(stronger|punchier|sharper|strengthen|improve|better|rewrite|reword|tighten|shorter|plainer|clearer)\b/i.test(lower)) {
    const target = findChatTarget(doc, text) || candidatesOf(doc).find((item) => item.kind === "bullet");
    if (target) {
      return finish(target, strengthenLine(target.original), "reword",
        "Same facts, stronger framing. Check it still sounds like you before approving.");
    }
  }
  // Anything else is treated as new evidence: a new line in the user's words.
  return finish(null, userLine(text), "user", "New line from what you just told me. It lands in your answers, not as a verified fact.");
}

// Apply an APPROVED chat proposal to the doc. Pure: returns a new doc,
// never mutates the input. Only the app's Approve button calls this.
export function applyChatProposal(doc, proposal) {
  const next = JSON.parse(JSON.stringify(doc || {}));
  const text = String(proposal?.proposed || "").trim();
  if (!text) return next;
  const target = proposal?.target || { kind: "new" };
  if (target.kind === "summary") next.summary = text;
  else if (target.kind === "bullet" && next.roles?.[target.roleIndex]?.bullets) {
    next.roles[target.roleIndex].bullets[target.bulletIndex] = text;
  } else if (target.kind === "highlight" && Array.isArray(next.highlights)) {
    next.highlights[target.index] = text;
  } else if (target.kind === "skill" && Array.isArray(next.skills)) {
    next.skills[target.index] = text;
  } else {
    next.highlights = [...(next.highlights || []), text];
  }
  return next;
}
