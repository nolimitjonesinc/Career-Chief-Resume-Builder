# Career Chief

**Last updated:** October 6, 2026
**Status:** Prototype. Branch `feature/trust-and-evidence` adds the trust layer, evidence ledger, smarter interview, job comparison and parse check (see `PLAN.md`, `IMPROVEMENTS.md`). `main` is untouched until Danny merges. **Pro license-key unlock is implemented on `main` (Oct 4, 2026); the Lemon Squeezy store IDs are not yet configured — see `LEMON_SQUEEZY_SETUP.md`.**
**Lives at:** local only — dev server at `localhost:5199`. Built to deploy to Cloudflare (Workers + static assets); the project's own notes refer to a "deployed demo" running without an AI key. ‹CHECK› is there a live link, and where?
**Repo:** `nolimitjonesinc/Career-Chief-Resume-Builder` (private)

> **Truth rule:** every line below must be verifiable in this project's own files.
> Anything inferred, assumed, or remembered gets marked **‹CHECK›** so Danny can
> confirm or kill it. A doc that guesses silently is worse than no doc.

---

## 1. What it is

Career Chief is a "chief of staff" for applying to a specific job. You bring your resume plus whatever material you have about the target company and role — files, pasted text, public web pages — and it shows you what it actually read, builds a hiring case for you, then interviews you one question at a time to fill the gaps. Every suggested resume change is shown to you for approval before it lands, and you can export the finished resume as Word, PDF, HTML, or plain text.

It runs two ways. With no AI key configured it uses a transparent rule-based analyzer and never sends your text anywhere. With a server-held OpenAI key configured *and* you ticking the research box, it researches the company and role with live web search, builds the hiring case from cited sources, and generates the question plan and draft screening answers.

## 2. Who it's for and what problem it solves

- **User:** an overwhelmed senior professional applying to a role they genuinely want. ‹CHECK› — this is stated in the UX audit as the audit persona; confirm it is the real target user.
- **Problem:** tailoring a resume per company means re-reading the job post, re-researching the company, and re-remembering your own accomplishments every single time. Generic AI resume tools guess, inflate, and produce claims you can't defend in the interview.
- **The bet:** the value is in the homework and the interview, not the word processor. Do the research, name the real objection a hiring manager will have, then ask only questions whose answers would actually improve the application — and never state anything the user hasn't confirmed they own.

## 3. Goals

What "done and working" means:

1. Accept imperfect real-world career material in common formats without the user reformatting anything.
2. Show the user exactly which sources were used and what was extracted from each.
3. Produce a company-specific hiring case: strongest truthful fit, likely screening risk, what's missing.
4. Ask a finite, prioritized set of questions, and only ask one when its answer could change the output.
5. Never put an unsupported claim or invented metric into the resume — every change gets user approval.
6. Let the user finish at any point and walk away with a usable document.
7. Do the company and role research automatically, with real citations, rather than making the user gather it.
8. Build up confirmed career evidence once and reuse it for the next company.
9. ‹CHECK› Not a goal in code yet: accounts and cross-device storage. Confirm whether that's in scope or deliberately later.

## 4. The mental model

One loop, run per company application:

```
SOURCES IN  →  ANALYZE  →  HIRING CASE  →  INTERVIEW  →  APPROVE  →  EXPORT
(files,        (rules, or   (fit, risk,    (one Q at     (review     (DOCX/PDF/
 paste,         AI + live    what's         a time,       each        HTML/TXT)
 public URL)    web search   missing,       answers can   proposed
                if opted     cited links)   spawn         resume
                in)                         follow-ups)   line)
                     ↑                           │             │
                     └── add context, re-analyze ┘             │
                                                               ▼
                                              confirmed answers join the
                                              CAREER EVIDENCE BANK, reused
                                              by the next company
```

Three ideas hold the whole product together:

- **Evidence, not keywords.** Nothing is claimed unless it can be found in the user's own material. What can't be found becomes a gap, and gaps become interview questions.
- **Nothing lands without approval.** Answers become proposed wording, shown next to the current line, editable, applied only on approval. Undo is always available.
- **Research is cited or it isn't shown.** In AI mode, a public finding is displayed only when the model returned a real URL citation for it. Uncited claims are dropped rather than softened.

## 5. Feature list — what exists today

### Intake
- Upload and extract text from PowerPoint (.pptx), PDF, DOCX, HTML, TXT, Markdown, and RTF — all in the browser, nothing uploaded to a server.
- **PowerPoint reading** pulls slide text in the order the slides are shown, speaker notes (often where people write what they actually did), table rows kept together, and the numbers inside charts. Hidden slides are included and marked. Old .ppt and Keynote files get a plain-English "save it as .pptx" message instead of failing silently.
- **"What should it help with?"** — every added source can be aimed at a part of the application: my current role, past roles and accomplishments, the role I want, or my future cover letter (or let Career Chief decide). This is separate from what the source *is*.
- Paste unstructured text directly.
- Add a public HTTPS web page; a small server reader pulls its text, with URL validation plus size and timeout limits, and falls back to paste/upload when a page won't cooperate.
- Sources are categorized: resume, job description, application questions, company research, leadership, current role, career goals, other.
- An explicit AI-research checkbox, shown only when the server actually has a key. Off by default.
- A built-in fictional sample case (Jordan Avery / Nestwell) to walk the full experience without your own files.

### Analysis — two modes
- **Rule-based (default, no key):** maps explicit job-posting language against your supplied evidence across 22 themes (nine marketing themes from the original sample plus thirteen general ones: analytics, product, engineering, sales, operations, project delivery, stakeholders, customer outcomes, finance, compliance, hiring and coaching, design, AI), entirely on your own machine. Each supported theme carries a strength (backed once or more than once) and the sentence of yours that backs it.
- **AI research (key configured and box ticked):** researches the named company and role with live web search, then builds the hiring case from your sources plus that research. Returns thesis, strongest fit, caution, supported points, unproven requirements, a 3–7 question plan, cited findings, and draft answers to any real screening questions you supplied.
- Both modes produce a visible summary and let you open any source to read the exact extracted text used. Adding context re-runs the analysis.

### Hiring case and research
- Hiring-case view with the thesis and requirement-by-requirement supported/unsupported status.
- Research view with a finding and strategic implication per source, plus cited public findings with clickable source links in AI mode, and an explicit warning not to treat public material as proof of personal ownership.

### Interview
- A prioritized question plan, always visible with progress, one question in focus at a time.
- Each question shows why it's being asked and a tip for answering.
- Rule mode: six generic questions, or a seven-question fictional sample plan, **plus up to three questions built from your own material** (see below). AI mode: 3–7 questions generated from your actual evidence.
- **Own-words questions (works with the AI off).** Quotes a line of yours that has no figure and asks how big it was; asks about a two-word phrase you repeat across documents; notices a gap or overlap in your resume dates (or a run of year-long roles) and asks about it gently. It quotes and asks; it never guesses an answer. Each has its own topic because saved answers are keyed by topic. The sample asks one.
- **Deck questions** — each uploaded deck (up to three) gets its own question naming the deck and its slide titles: what was your part, and what should the resume say about it. Deck answers aimed at the current role are added to the current-role section instead of the tailored achievement line.
- Answer-dependent follow-ups — in AI mode the model can return one narrow follow-up per answer when a real ambiguity remains.
- Questions can be skipped, and you can finish at any time.

### Resume control and evidence
- Working resume visible beside the reasoning from early on.
- Review-before-apply on every proposed change, with editable wording.
- Full direct editing of all nine resume sections, plus undo history.
- **Career evidence bank** — confirmed interview answers are kept and fed into the next company's analysis.
- **Dynamic company applications** — create a new company application that reuses the evidence bank while keeping its own role, questions, and resume draft. Saved applications can be reopened.
- **Start new** — a header button, shown once anything has been entered, with two choices: apply for a different job (keeps resume, documents and interview answers; the current application stays saved) or erase everything from this browser. The keep option leads; the erase option says plainly it can't be undone. The small "Clear saved draft" link on the first screen now asks for confirmation instead of wiping instantly.
- **Browser-local autosave** — the whole working draft survives a refresh on the same device, and can be cleared from the source screen or evidence panel.
- Export to DOCX, PDF, HTML, and TXT.
- **Career Chief Pro (license-key unlock, Oct 4, 2026).** Finished resume exports (Word, PDF, HTML, plain text) require a Pro license; everything else — intake, analysis, interview, on-screen preview, direct editing, ledger, coverage, parse check — stays free. Buying opens the Lemon Squeezy hosted checkout in a new tab; the emailed license key is activated in the app (header "Go Pro" button or the Finish dialog). The public License API (activate/validate/deactivate) is called from the browser — no API secret ships with the client. The license (key + instance id) lives in browser localStorage next to the draft: no accounts, one browser per activation seat. Validation runs on load and at most once a day afterwards; any failure fails closed to the free tier with a plain-English notice. Deactivation is in the Pro dialog. Config (store/product/variant IDs, checkout URL, price label) comes from `VITE_LS_*` env vars; until the variant ID is set the buy button stays hidden. Decision: Rule 13 ("finish is always available") means finishing the interview with the on-screen working draft — finished file exports are the paid boundary. Setup checklist: `LEMON_SQUEEZY_SETUP.md`.
- **Evidence ledger** ("Where each line came from", under the working resume and in Finish). Every resume line is labelled: from your answer, from your documents (with the matching sentence quoted), written by Career Chief (the generic summary and capabilities lines), placeholder, or not traced. A line containing a figure that appears in none of your answers or documents is marked "to check". **Informational only: it never blocks, hides or edits anything** (Rule 1).
- **Role coverage** on the hiring case (rule mode): which of the role's priorities your material backs, how strongly, and with which of your sentences. It updates live as you approve answers. Deliberately **not an ATS score**.
- **Why this wording** under every proposed line: how much came from your answer, what changed, which role priorities it speaks to, and whether any figure was added. Updates as you type.
- **Ask for a change** (AI mode only, after opt-in): reword the proposed line ("shorter", "plainer"). The request changes tone, never facts; the server and the page both flag any figure that isn't in your material.
- **Tailor this resume to the job** (Finish window, Oct 5 2026, branch `feature/claude-haiku`). With AI on: the AI reorders and lightly rewords the current-role lines (each line numbered so none can be dropped), reorders the skills, and offers a new summary. Without AI: lines and skills are reordered by the job post's own words, nothing added or reworded. The user ticks each part and approves; Undo works. A bad AI summary is dropped on its own; a bad line list is refused whole and the user is offered the simple reorder instead.
- **Private-preview access code** (Oct 6 2026, branch `feature/claude-haiku`, not yet live). When the environment setting `ACCESS_CODE` is set (one code, or several separated by commas), the website shows a code screen first, and the AI routes and the link reader refuse any caller without a matching code (the server check is the real lock; the screen is a courtesy). Unset = open site, as before. Codes are remembered on the device; a changed code sends people back to the screen; 10 wrong guesses an hour locks that caller out. The AI status check stays open. Limit: one shared code identifies no one; per-person codes are a later step. The wrong-guess counter is shared by the code screen, the AI routes and the link reader, and keys on the address the hosting edge reports (Vercel's or Cloudflare's own header, never a plain forwarded-for, which callers can forge; the same address now feeds the AI hourly limit). Until a shared store is bound, the counter is per server instance on serverless, so it slows a guesser rather than stopping one. Tested: 9 new checks plus a live browser run of locked, wrong code, right code, refresh, changed code.
- **Compare jobs** tab: up to three postings against everything you've told Career Chief, with what to lead with for each, the line of yours that backs it, what's unique to each, what's thin, and what isn't in your record yet. Rule-based and free to run; saved in the browser draft.
- **Parse check** in Finish: a checklist (contact present, dated roles, no placeholders, characters the PDF can print, length) plus an optional read-back test that builds your real Word file and reads it back with a document parser. No score.
- **Homepage before/after**: one fictional example (resume line, question, approved wording) generated from the real sample and the real proposal function, so it can't drift from what the app does.
- **Guided tour (on `main`; unmeasured, so treat as an experiment).** On first visit to the empty intake screen it opens with a ring on the headline, then rings each real field in order (resume, job, optional sources, Analyze, then the before/after card). The page scrolls to each stop, one thin arrow draws from the last stop to this one, and a hand-lettered speech bubble beside the field (Caveat font, bundled, OFL) writes its one short line in, then pops away as the tour moves on. The lines: "Every job gets its own resume. Updated. Custom tailored. For you." / "Just drop in your current resume." / "Add the job you want." / "Add decks and notes. Optional." / "It tailors your evidence to the new role." / "Sharp questions. You approve every line."; it ends on a bubble at the sample link: "That's all you have to do! We'll do the rest." with a "Try it with a sample" button. The page's own "1 / 2 / 3" step list lights in sync. It stops instantly on any click, key, wheel or touch (except on its own Skip/Replay controls); "Skip" and a "Replay the tour" chip stay available. Not autoplayed for someone who already started typing, for reduced-motion users (a manual chip instead), or with `?tour=off`. About 20 seconds. Verified with 23 browser checks (stop-on-touch, Skip, replay, reduced motion, saved draft, stage lighting, no bottom bar); these are not in `npm test`. There is no measurement yet of whether it helps people start.

### Craft
- Responsive layout, semantic controls, visible keyboard focus styles, native dialogs with focus restoration.
- A persistent on-screen strip stating which mode is active and that the draft lives in this browser.
- Passed its own design QA against the source visual mock.

## 6. How it works underneath

- **Stack** — React 19 + Vite 6. Phosphor icons. Client-side extraction via pdfjs-dist (PDF) and mammoth (DOCX). Export via docx and jspdf. Deploys as a Cloudflare Worker serving static assets with SPA fallback. esbuild bundles the worker.
- **Where data lives** — the browser, and only the browser. The entire working draft is written to browser-local storage under one key and read back on load; reads and writes are both wrapped so that a browser blocking storage degrades to a normal session instead of crashing. No database, no accounts, no server-side storage of anyone's career material. Clearing site data erases it, and it does not follow the user to another device.
- **The key mechanism — rule mode:** a deterministic analyzer. It matches nine theme keywords against the job text to decide what the role requires, then runs a pattern per theme against the user's own material to decide whether they've evidenced it. Supported themes become strengths; unsupported ones become gaps and drive the caution line.
- **The key mechanism — AI mode:** three jobs, one model each, picked as the cheapest that does the job well — research on GPT-5.6 Terra, the hiring case on GPT-5.5 because that judgement is the product, and per-answer resume wording on GPT-5-mini. All three are overridable by environment variable so cost can be retuned without code changes. Web search is not documented as supported on the cheaper models, so a research call that fails falls back once to GPT-5.5 rather than losing the research step. Note the search tool itself bills per call on top of tokens, and dominates the cost of the research step. Mechanically: two calls to OpenAI's Responses API. The first researches the company and role with the `web_search` tool and returns prose plus URL citations. The second is given the candidate's trimmed sources *and* that research and must return strict JSON — thesis, fit, caution, known, gaps, questions, research, application drafts. The server then throws away any research item whose URL is not in the citation list from call one, so an uncited claim cannot reach the user. A third call per answer produces the proposed resume line and an optional follow-up question. A fourth route, `revise`, rewords one proposed line on request. Every AI-written line is checked for figures absent from the candidate's own words. Every field is length-clamped on the way out. The system prompt explicitly instructs the model to read uploaded text as evidence rather than instructions, never to invent metrics or scope, and never to treat a public project as proof of the candidate's ownership.
- **The safety layer (shared by every runtime).** One handler enforces, in order: the master switch (`AI_ENABLED=true` **and** a key; previously only the Vercel adapters checked it, so the Worker and dev server ignored it); a same-origin check (a browser on our own site matches, a curl loop or another site doesn't; it's a speed bump, not authentication); request validation; then a spend check (per-caller hourly limit plus a site-wide daily budget, counted in units: plan 10, answer check or rewrite 1). Invalid requests spend nothing. The model's response is read with a 1 MB cap. All limits are environment-overridable (`AI_DAILY_UNIT_CAP`, `AI_PER_CALLER_HOURLY`, `AI_MAX_RESPONSE_BYTES`, `AI_ALLOWED_ORIGINS`). `OPENAI_BASE_URL` points the provider at a gateway or a local fake. The dev server answers AI routes only to requests from this machine.
- **Claude as the AI provider (branch `feature/claude-haiku`, Oct 5 2026, not merged).** If `ANTHROPIC_API_KEY` is set it is used instead of OpenAI (override with `CAREER_AI_PROVIDER=openai`). One model, Claude Haiku 4.5, does research (Anthropic web search, citations kept only if the search tool attached them), the hiring case and per-answer wording. The consent box and status say which company gets the text. Measured live Oct 5: about $0.12 per plan and $0.003 per answer check; three full job runs cost $0.43. Measured live Oct 5 (Haiku 4.5): research 25-57 s once per plan, each answer check about 3-5 s, tailoring 5-13 s, about $0.09 per job all-in. Guards (server, `shared/gaps.mjs`): AI wording is refused if it confesses a gap, hedges, describes a plan or willingness, inflates a title (director/leader/head...), adds a figure, adds skills, or uses too many words the person never said (more than 35% novel). Interview questions and the Start button are held while the AI is still researching so the plan cannot swap under the user. **Not verified live after the last four guard fixes** (the Anthropic account ran out of credits during the final run): covered by 107 unit tests built from real failures, but rerun the three-job live check once credits are added.
- **External services** — OpenAI (or Claude, above), optional. The key is read from the server environment and never reaches the browser; the app asks a status endpoint whether a key exists and only then offers the checkbox. Candidate text is sent only after the user ticks it. With no key the endpoint refuses and the app says so plainly.
- **File map**
  - `src/App.jsx` — the entire UI and all state; every screen, panel, and dialog.
  - `src/lib/analyze.js` — the rule-based analyzer, sample case data, question plans, resume-change proposals.
  - `shared/career-ai.mjs` — the AI research and interview engine, its prompts, JSON handling, and citation filter.
  - `src/lib/ingest.js` — file and URL text extraction.
  - `src/lib/pptx.js` — the PowerPoint reader (slides, notes, tables, charts), dependency-light and tested in Node.
  - `shared/source-limits.mjs` — how much of each source the AI sees; used by the browser (trims before sending) and the server (trims again).
  - `src/lib/exporters.js` — DOCX, PDF, HTML, TXT output.
  - `shared/url-extract.mjs` — public-page fetching and safety limits, shared by dev server and production worker.
  - `worker/index.js` — production hosting: the API routes plus SPA fallback.
  - `src/career.css`, `src/styles.css` — styling.
  - `src/components/` — Ledger, Coverage, Compare, ParseCheck, ProposalWhy, Showcase (new UI lives here so `App.jsx` stops growing). `src/trust.css` styles them.
  - `src/lib/evidence.js` (ledger), `probes.js` (own-words questions), `compare.js`, `explain.js` (why this wording), `parsecheck.js` + `docx-build.js` + `parse-runtime.js` (export check), `draft.js` (saved-draft version and migration).
  - `shared/claims.mjs` — finds figures in text and checks they trace to the user's material; used by browser and server. `shared/ai-guard.mjs` — master switch, origin check, rate and budget limits, bounded response reader. `shared/config.mjs` — every server-side limit in one place. `shared/net-safety.mjs` — private-address detection and the DNS check. `shared/limited-read.mjs` — size-capped body reader.
  - Tests (`npm test`; run `npm run build` first because one hosting test checks build output): `career-ai` 15, `claims` 9, `compare` 5, `evidence` 13, `net-safety` 14, `parsecheck` 4, `probes` 9, `pptx` 2, `sites-worker` 6, `license` 17, `license-store` 9 = 103.
  - `AGENTS.md` — instructions left for coding agents working in this repo.

## 7. Rules of the house

Decisions that must not be reversed. Check every new request against these.

1. **It's the user's resume, and the user decides what goes in it.** (Danny, Sep 29, 2026: "we don't want to limit what a user can put in their resume.") Career Chief's job is to dig through everything they share — decks, docs, notes — and propose strong wording; the user can rewrite anything. What the app never does is slip in a claim the user hasn't seen and approved, and public company material is context about the company, not proof of the candidate's work.
2. **The app never makes up numbers.** Figures from the user's own material (a deck's chart, their answer) are fair game; the AI never invents one. The user can type whatever they want. The old rule-mode tag "Outcome remains qualitative pending stronger evidence" was removed Sep 29, 2026 because it wrote a caveat into the user's resume.
3. **Nothing enters the resume without explicit approval.** Review-before-apply, editable wording, and undo are not optional polish.
4. **Manual user edits are protected.** Once the user has written their own wording, nothing overwrites it silently.
5. **One question in focus, but the full plan stays visible.** An earlier version hid the plan and the whole product read as a single-question demo.
6. **Only ask a question whose answer could improve the output.** Question count is a cost to the user, not a feature.
7. **The AI key lives server-side and never ships to the browser.** The app asks whether a key exists; it never handles one.
8. **Candidate text goes to the model only after the user explicitly opts in**, per session, with the choice visible on screen. No key means no call, ever. (On the feature branch the opt-in is no longer restored from the saved draft, so a reload asks again; on `main` it persisted across reloads, which broke "per session".)
9. **A public research finding is shown only if it carries a real citation.** Uncited items are discarded, not reworded into something vaguer.
10. **Uploaded text is evidence, not instructions.** Stated in the model's system prompt; keep it there, because sources are user-supplied documents and job posts.
11. **The UI must always say which mode is running.** Users must never have to guess whether they're getting live research or pattern matching.
12. **Show the user what was actually read.** The source stack and extracted-text views exist because a tool claiming to "do the homework" must prove it did.
13. **Finish is always available.** The user can leave with a usable document at any point.
14. **Carey is research context, not the target user**, and sample data stays visibly fictional.
15. **The ledger, coverage view and parse check inform; they never gate.** ‹CHECK› Proposed on `feature/trust-and-evidence` to reconcile "show where every claim came from" with Rule 1 ("we don't want to limit what a user can put in their resume"). Confirm.
16. **No scores.** No ATS score, no "87/100": that is invented precision. Show checklists and quoted evidence instead. ‹CHECK› Proposed on the same branch. Confirm.
17. **The AI never writes a gap, a plan, a hedge or a bigger title into the resume.** ‹CHECK› Added Oct 5 2026 after live runs showed it doing all four. Enforced in the prompt and by a code backstop (`shared/gaps.mjs`); a refused line falls back to the person's own words, which they can edit or skip.

## 8. Known gaps / not built yet

These are documented limits, not bugs to rediscover.

- **The live AI switch is OFF unless `AI_ENABLED=true`.** Correction (Oct 1, 2026, on the feature branch): the Sep 30 change only gated the Vercel adapters; on `main` the Worker and dev server still turned AI on whenever a key was present. On the feature branch the gate is inside the shared handler, so every runtime honors it. Until that branch is merged, treat `main`'s switch as unreliable on the Worker path.
- **The AI path has never run against a real paid account.** On the feature branch it has been driven end to end through the real UI against a local fake provider (plan, answer check, rewrite, origin check, limits), and by 13 AI tests. Not exercised with live billing. Treat first real use as a test, and measure real cost per plan then: the unit costs (plan 10, check 1) are estimates.
- **Spend limits are soft, and unmeasured.** (Feature branch.) There is now an origin check, a per-caller hourly limit and a site-wide daily budget. But the default store is in-memory and per instance: on serverless runtimes each instance counts separately, so it is a ceiling with slack, not a hard cap. A hard cap needs a shared store bound as `env.AI_LIMIT_STORE` (Workers KV or a Durable Object); the interface is ready, no adapter is written. The origin check is not authentication: anyone can forge headers. Do not put a key on a public URL until a shared store exists and the first live run has measured real cost per plan.
- **The dev server still listens on the whole local network** (binding unchanged, a decision for Danny), but on the feature branch its AI routes answer only requests from this machine.
- **AI response size is capped (1 MB).** Done on the feature branch.
- **Public-page reader: SSRF narrowed, not proven closed.** (Feature branch.) It now resolves the hostname (DNS-over-HTTPS, two providers, and a provider's answer counts only if both the A and AAAA lookups succeeded) and refuses any host with a private, loopback, link-local, metadata or reserved address. IPv6 is allow-listed: only global unicast (2000::/3) can pass, minus 6to4/NAT64/mapped addresses that embed a private IPv4, Teredo and documentation ranges. Trailing-dot hostnames are checked as their real names, re-checks every redirect hop before requesting it, and refuses credentials, odd ports and IPv6 literals. The link-reader route itself now also requires a same-origin caller. Remaining: a DNS-rebinding race between the check and the connection (no IP pinning is possible on these runtimes); the check depends on a third-party resolver (Cloudflare DoH) that sees the hostnames; and none of it has been penetration-tested. Verify Cloudflare's own refusal of private addresses before relying on it.
- **Storage is one browser on one device.** No accounts, no encryption, no cross-device sync, no version history, no audit trail, no server-side deletion controls. Clearing site data wipes everything.
- **The Pro gate is client-side.** A technical user can bypass it in the browser; it is an honest paywall, not DRM. Server-side enforcement would need accounts and webhook verification — deliberately not built (Oct 4, 2026).
- **Pro licenses are per-browser.** Like the draft, an activated license does not follow the user to another device; deactivating here frees the seat for activation there.
- **PowerPoint: text only.** Words, notes, tables and chart numbers are read; text baked into images or screenshots, SmartArt, and embedded videos are not. Old .ppt, Keynote and OpenDocument decks must be re-saved as .pptx first. Decks are capped at 200 slides and 150 MB.
- **Cover letter not built yet.** Sources can already be aimed at "my future cover letter" and the AI is told about that focus, but no cover letter is produced.
- **Resume parsing is lightweight.** Complex columns, tables, scanned PDFs, OCR, comments, tracked changes, and embedded media all need a production parser.
- **Link reading is limited.** Text-only; login walls, JavaScript-only pages, and robots restrictions will fail. Linked PDFs and Word files must be downloaded and uploaded manually.
- **Exports don't preserve the original layout.** They generate fresh documents from the approved draft.
- **Own-words questions, themes and coverage are English-only keyword heuristics.** The probes pick which unquantified lines to ask about by simple rules (action verb, scope word, resume first), not by importance; the 22 themes are regex lists that will miss unusual vocabulary. Compare jobs is the same matcher, not AI. The parse check is a checklist plus a Word read-back, not a real applicant system; it says so.
- **Interview stories aren't built.** Draft screening answers exist in AI mode; prepared interview stories do not.
- **Claim tracing is approximate.** The evidence ledger traces lines to your answers and documents by word overlap (70% of a line's content words inside one passage), so a heavily reworded line can fail to trace and a loosely reworded one can trace to a passage it only resembles. It shows the matching passage so you can judge. It does not verify that anything is true. Figures are compared as typed tokens: a plain count, a percentage, a multiplier and a dollar amount never match each other ("$2000" is not supported by "2000 employees"). It understands digits, grouped commas, full-width digits, "k/m/b", "million", "percent", "dollars", spoken numbers (sixteen, ninety, forty-two, a dozen, six million) and double/triple. A bare year counts as a date only with date context ("since 2021", "2018–2021", a year ending a line); "reached 2000 customers" is a figure. The ledger and the why-box check against the user's OWN material only (resume, current role, goals, earlier answers), never the job post or company research. Still misses a lone "one" and written-out fractions.
- **Accessibility unverified.** Labels, focus styles, and semantics are in place, but keyboard order, screen-reader output, zoom reflow, and WCAG conformance were never confirmed by testing.
- **Browser-local persistence and dynamic company switching have not had a final hands-on interface check** — the project's own notes call for one.

## 9. Deeper history

Design and product reasoning already captured in this folder:
- `PROTOTYPE.md` — what's genuinely functional, boundaries, and production acceptance criteria
- `ux-audit.md` — the pre-build audit, risks found, and recommendations
- `design-qa.md` — visual comparison against the source mock, findings and fixes
- `AGENTS.md` — working instructions for coding agents in this repo

Build log: `../build-logs/logs/career-chief-prototype.md`
Reusable parts extracted from here: `../CAPABILITIES.md`
