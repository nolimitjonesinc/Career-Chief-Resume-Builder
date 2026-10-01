// The saved draft lives in the browser, so its shape has to survive upgrades.
// Every change to that shape bumps DRAFT_VERSION and adds a step here; a draft
// from any older version is walked forward instead of being thrown away.
export const DRAFT_VERSION = 2;
export const storageKey = "career-chief-local-draft-v1"; // key is unchanged on purpose: same slot, versioned contents.

const steps = {
  // v1 -> v2: job comparison list added.
  1: (draft) => ({ ...draft, compareJobs: draft.compareJobs || [] }),
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
