// The saved draft lives in the browser, so its shape has to survive upgrades.
// Every change to that shape bumps DRAFT_VERSION and adds a step here; a draft
// from any older version is walked forward instead of being thrown away.
import { parseResumeText } from "./analyze.js";
import { PLACEHOLDERS } from "./exporters.js";

export const DRAFT_VERSION = 3;
export const storageKey = "career-chief-local-draft-v1"; // key is unchanged on purpose: same slot, versioned contents.

const stripPlaceholder = (value) => {
  const text = String(value ?? "").trim();
  return PLACEHOLDERS.has(text) ? "" : text;
};

// v2 -> v3: the resume went from flat text blobs per section to a structured
// doc (roles with bullets, education/skills as lists). Old drafts are
// re-parsed through the new parser instead of dropped: the same words come
// back with real structure, and stale artifacts (a literal "undefined", a
// mangled header) are left behind. Approved interview lines keep their own
// list so the interview loop survives the upgrade.
const toStructuredDoc = (old) => {
  if (!old || typeof old !== "object" || Array.isArray(old.roles)) return old;
  // Rebuild with explicit section headings so each old blob lands in the
  // right place; stale artifacts (a literal "undefined", a mangled header)
  // are left behind.
  const head = [old.name, old.title, old.contact, old.summary].map(stripPlaceholder).filter(Boolean).join("\n");
  const experience = [old.current, old.earlier].map(stripPlaceholder).filter(Boolean).join("\n");
  const education = stripPlaceholder(old.education);
  const skills = stripPlaceholder(old.skills);
  const parts = [head];
  if (experience) parts.push("EXPERIENCE", experience);
  if (education) parts.push("EDUCATION", education);
  if (skills) parts.push("SKILLS", skills);
  const body = parts.filter(Boolean).join("\n").replace(/\bundefined\b/gi, " ").replace(/[ \t]{2,}/g, " ");
  const doc = parseResumeText(body);
  const highlights = stripPlaceholder(old.tailored);
  if (highlights) doc.highlights = highlights.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return doc;
};

const steps = {
  // v1 -> v2: job comparison list added.
  1: (draft) => ({ ...draft, compareJobs: draft.compareJobs || [] }),
  // v2 -> v3: structured resume doc.
  2: (draft) => ({ ...draft, doc: toStructuredDoc(draft.doc) }),
};

// A draft written by a newer build must not be guessed at, and must not be
// overwritten by this one either (see isNewerDraft).
export const isNewerDraft = (draft) => Number.isInteger(draft?.draftVersion) && draft.draftVersion > DRAFT_VERSION;

export function migrateDraft(draft) {
  if (!draft || typeof draft !== "object" || isNewerDraft(draft)) return null;
  try {
    let current = { ...draft };
    // Missing, zero, negative or non-integer versions are treated as the first.
    let version = Number.isInteger(current.draftVersion) && current.draftVersion >= 1 ? current.draftVersion : 1;
    while (version < DRAFT_VERSION) { current = steps[version](current); version += 1; }
    return { ...current, draftVersion: DRAFT_VERSION };
  } catch { return null; } // a damaged draft starts a fresh session instead of a blank page
}
