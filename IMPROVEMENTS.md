# "This is good, but how can I make it better?"

Asked after every function, before moving on. **Done** = changed in the same pass.
**Left** = real, not done, with the reason. Nothing here is a polite non-answer.

## Server safety

| Function | Done | Left, and why |
|---|---|---|
| `aiSwitchOn` (master gate) | Moved the `AI_ENABLED` check into the shared handler. Before, only the Vercel adapters checked it, so the Worker and dev server turned AI on whenever a key existed. | None. |
| `assertAllowedOrigin` | Added `AI_ALLOWED_ORIGINS` for a future separate frontend. Compares against the `Host` header so the dev server's rebuilt request still matches. | Headers can be forged. This is a speed bump, not authentication. Real protection is accounts. |
| `spendOrThrow` | Invalid requests spend nothing (validate first). Callers are hashed; no raw IP is stored. Store is an interface. | The default store is per-instance, so on serverless it is a soft cap. Needs a Workers KV / Durable Object adapter before a key goes on a public URL. |
| Default limits | Found by driving the real UI that my first defaults (6/hour, plan = 3) would lock a user out mid-interview. Now 30/hour, plan = 10, 300/day, and a test proves one full interview fits. | The unit costs are estimates. Measure real cost on the first live run. Longer term: count real provider usage, not units. |
| `readJsonLimited` / `readBytesLimited` | One reader for model responses (reject) and web pages (truncate); the page reader used to buffer the whole page before slicing. | None. |
| Link reader (SSRF) | Resolves the host, refuses private/loopback/link-local/metadata (v4, v6, mapped, NAT64), checks every redirect hop *before* requesting it, refuses credentials, odd ports, IPv6 literals. 9 tests. | DNS-rebinding race can't be closed without IP pinning, which these runtimes don't allow. Depends on a third-party resolver. Not pen-tested. Verify on the real Worker. |
| Vite dev server | AI routes answer only from loopback; status stays open. The wide binding is unchanged: that's Danny's call. | Decide whether the wide binding should stay. |

## Claims and evidence

| Function | Done | Left, and why |
|---|---|---|
| `numbersIn` / `unsupportedNumbers` | `1k`, `1,000`, `1000`, `$1.2M`, `1,200,000` are one claim. Years are ignored. Number words two–twenty and tens map to digits. A precomputed known-set avoids re-scanning every document per line. | Misses "a dozen", "double", "one". Cheap to extend; riskier to over-flag. |
| `traceLine` / `buildLedger` | **Browser pass found** a real resume line marked "Not traced" because only single sentences were compared; now whole lines and windows of up to three sentences. Picks the tightest excerpt. Tokenizes each source once. Generic summary/skills lines the app wrote are labelled as such. | Word overlap, not understanding. A reworded line can miss; a similar one can match. It shows the passage so the user decides. |
| `evaluateRequirements` | **Browser pass found** evidence quotes that ran across two documents ("BA Communications, 2015 Jordan created…") and cut mid-word. Sources now join with newlines; excerpts prefer a real sentence over a title; cuts land on a word boundary. 22 themes instead of 9 (rule mode was marketing-only). | Regex themes, English only. A theme list will always miss vocabulary. |
| `coverageFor` | Now live: counts answers approved so far (before, "supported so far" never moved). | Same matcher limits. |

## Interview

| Function | Done | Left, and why |
|---|---|---|
| `unquantifiedLines` | Skips its own saved answers, decks and the target role. Resume lines rank first. | Ranking is simple rules. Should favor recent, senior roles. |
| `probeQuestions` | **Browser pass found** two questions with the identical topic "How big was it?" — and saved answers are keyed by topic, so the second would have overwritten the first. Topics now quote the line. The sample is capped at one probe so it doesn't repeat question 1. Stable ids so a refresh doesn't duplicate. | English-only. Doesn't know the "why" behind a gap; it asks gently and only. |
| `careerShape` | Year granularity handled honestly (a gap needs two full years between end and start). | No month-level dates, no non-English "present". |

## Features

| Function | Done | Left, and why |
|---|---|---|
| `compareJobs` | Max three, ties don't crown a winner, short posts ignored, approved answers count as evidence. Gap line says "only claim these if you have evidence". | It is the same matcher as coverage, so it shares its blind spots. An AI-assisted version is an option once spend is controlled. |
| `explainProposal` | Describes what actually differs between answer and proposal, so it can't misdescribe what the app did. Recomputes as you type. | The "% of words from your answer" is a blunt measure. |
| `ProposalWhy` revise | Result message shown inside the dialog (page banners sit behind the open dialog). Candidate text goes only after the AI opt-in. | Needs a real model to judge quality. Verified only against a fake. |
| `staticChecks` / `roundTripChecks` | Round trip builds the real Word file and reads it back with the same parser the app already ships. Runs in the browser (verified). | "Single column" row is a fact about our export, not a measurement. No PDF read-back. |
| `sampleTransformation` | Built from the real sample and real proposal function; test fails if it drifts. Fixed a whole-paragraph quote found in the browser. | Only one example. Real before/afters need real users. |
| `migrateDraft` | Old drafts walk forward; a draft from a newer build is not guessed at. | A newer-build draft is replaced when this build autosaves. Acceptable for a local prototype. |

## Process
- Found 6 defects only by driving the real app, not by unit tests. A browser pass belongs in every change that touches UI.
- The AI path has now run end to end (against a fake provider). It has not run on a real account. Do not read "works" as "good".
