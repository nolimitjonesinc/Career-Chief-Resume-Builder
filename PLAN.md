# Plan — trust, evidence, and a defensible interview

**Branch:** `feature/trust-and-evidence` (main is untouched).
**Source:** two outside reviews of the product + a check of both against the code.
**Rule:** every item is checked against `PROJECT.md` "Rules of the house". Nothing
here gates what the user may write (Rule 1), invents numbers (Rule 2), or lands
without approval (Rule 3). The AI switch stays OFF; nothing here needs a key to test.

## Order (safety first, because "free tier" = open AI spend)

| # | Item | Why | Needs AI key? |
|---|------|-----|---|
| 1 | One `AI_ENABLED` gate inside the shared handler | The Worker and dev server ignored the switch; only Vercel honored it | no |
| 2 | Origin check + per-caller rate limit + daily budget cap (pluggable store) + response size cap | Breaks "cap spend before launch" | no |
| 3 | SSRF fix in the link reader: resolve the host, reject private ranges, re-check every redirect hop | Must close before any public deploy | no |
| 4 | Claims module: numbers in a line must trace to the user's own words or documents | Rule 2, enforced instead of promised | no |
| 5 | Evidence ledger: each resume line shows where it came from. Informational, never blocking | "Nothing lands that you haven't approved" made visible | no |
| 6 | Smarter rule-mode interview: quotes your own unquantified lines, repeated claims, date gaps / overlaps | The differentiator ("we know what to ask") was AI-mode only and unverified | no |
| 7 | Role coverage with evidence strength (not an ATS score) | Name what already exists | no |
| 8 | Parse check on the export (can a parser read it?) — a checklist, not a number | Honest ATS answer | no |
| 9 | "Why this wording" + number guard on every proposal; optional AI "ask for a change" | Closes the one row where chat beats us | only the optional revise call |
| 10 | Compare up to 3 jobs against one evidence bank, with reasons | Turns the evidence bank into a visible asset | no |
| 11 | Homepage before/after, generated from the real sample + real functions | Proof beats claims | no |
| 12 | Docs, tests, build, browser check, draft PR | | no |

## Future-proofing decisions
- Pure logic lives in `src/lib/*.js` / `shared/*.mjs` with node tests; UI components live in `src/components/` so `App.jsx` stops growing.
- Limits and thresholds live in one file (`shared/config.mjs`), not scattered literals.
- The rate/budget store is an interface (`get`/`put`). In-memory is the default; a Workers KV or Durable Object drops in without touching callers.
- The saved draft gets a version number so the next change to its shape can migrate instead of breaking.

## After each function: "this is good, how can I make it better?"
Answered in `IMPROVEMENTS.md`: what I changed in the same pass, and what I left and why.

## Not in this branch (on purpose)
Accounts, payments, a paywall, the first live AI run, a human-review tier. All need decisions or spend that are Danny's, not mine at 2am.
