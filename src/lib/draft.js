// The saved draft lives in the browser, so its shape has to survive upgrades.
// Every change to that shape bumps DRAFT_VERSION and adds a step here; a draft
// from any older version is walked forward instead of being thrown away.
export const DRAFT_VERSION = 2;
export const storageKey = "career-chief-local-draft-v1"; // key is unchanged on purpose: same slot, versioned contents.

const steps = {
  // v1 -> v2: job comparison list added.
  1: (draft) => ({ ...draft, compareJobs: draft.compareJobs || [] }),
};

export function migrateDraft(draft) {
  if (!draft || typeof draft !== "object") return null;
  let current = { ...draft };
  let version = Number.isInteger(current.draftVersion) ? current.draftVersion : 1;
  if (version > DRAFT_VERSION) return null; // written by a newer build; don't guess at it
  while (version < DRAFT_VERSION) { current = steps[version](current); version += 1; }
  return { ...current, draftVersion: DRAFT_VERSION };
}
