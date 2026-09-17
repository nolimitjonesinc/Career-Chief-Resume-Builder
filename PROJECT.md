# Career Chief

**Last updated:** September 17, 2026
**Status:** Prototype
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
- Upload and extract text from PDF, DOCX, HTML, TXT, Markdown, and RTF — all in the browser, nothing uploaded to a server.
- Paste unstructured text directly.
- Add a public HTTPS web page; a small server reader pulls its text, with URL validation plus size and timeout limits, and falls back to paste/upload when a page won't cooperate.
- Sources are categorized: resume, job description, application questions, company research, leadership, current role, career goals, other.
- An explicit AI-research checkbox, shown only when the server actually has a key. Off by default.
- A built-in fictional sample case (Jordan Avery / Nestwell) to walk the full experience without your own files.

### Analysis — two modes
- **Rule-based (default, no key):** maps explicit job-posting language against your supplied evidence across nine themes, entirely on your own machine.
- **AI research (key configured and box ticked):** researches the named company and role with live web search, then builds the hiring case from your sources plus that research. Returns thesis, strongest fit, caution, supported points, unproven requirements, a 3–7 question plan, cited findings, and draft answers to any real screening questions you supplied.
- Both modes produce a visible summary and let you open any source to read the exact extracted text used. Adding context re-runs the analysis.

### Hiring case and research
- Hiring-case view with the thesis and requirement-by-requirement supported/unsupported status.
- Research view with a finding and strategic implication per source, plus cited public findings with clickable source links in AI mode, and an explicit warning not to treat public material as proof of personal ownership.

### Interview
- A prioritized question plan, always visible with progress, one question in focus at a time.
- Each question shows why it's being asked and a tip for answering.
- Rule mode: six generic questions, or a seven-question fictional sample plan. AI mode: 3–7 questions generated from your actual evidence.
- Answer-dependent follow-ups — in AI mode the model can return one narrow follow-up per answer when a real ambiguity remains.
- Questions can be skipped, and you can finish at any time.

### Resume control and evidence
- Working resume visible beside the reasoning from early on.
- Review-before-apply on every proposed change, with editable wording.
- Full direct editing of all nine resume sections, plus undo history.
- **Career evidence bank** — confirmed interview answers are kept and fed into the next company's analysis.
- **Dynamic company applications** — create a new company application that reuses the evidence bank while keeping its own role, questions, and resume draft. Saved applications can be reopened.
- **Browser-local autosave** — the whole working draft survives a refresh on the same device, and can be cleared from the source screen or evidence panel.
- Export to DOCX, PDF, HTML, and TXT.

### Craft
- Responsive layout, semantic controls, visible keyboard focus styles, native dialogs with focus restoration.
- A persistent on-screen strip stating which mode is active and that the draft lives in this browser.
- Passed its own design QA against the source visual mock.

## 6. How it works underneath

- **Stack** — React 19 + Vite 6. Phosphor icons. Client-side extraction via pdfjs-dist (PDF) and mammoth (DOCX). Export via docx and jspdf. Deploys as a Cloudflare Worker serving static assets with SPA fallback. esbuild bundles the worker.
- **Where data lives** — the browser, and only the browser. The entire working draft is written to browser-local storage under one key and read back on load; reads and writes are both wrapped so that a browser blocking storage degrades to a normal session instead of crashing. No database, no accounts, no server-side storage of anyone's career material. Clearing site data erases it, and it does not follow the user to another device.
- **The key mechanism — rule mode:** a deterministic analyzer. It matches nine theme keywords against the job text to decide what the role requires, then runs a pattern per theme against the user's own material to decide whether they've evidenced it. Supported themes become strengths; unsupported ones become gaps and drive the caution line.
- **The key mechanism — AI mode:** two calls to OpenAI's Responses API. The first researches the company and role with the `web_search` tool and returns prose plus URL citations. The second is given the candidate's trimmed sources *and* that research and must return strict JSON — thesis, fit, caution, known, gaps, questions, research, application drafts. The server then throws away any research item whose URL is not in the citation list from call one, so an uncited claim cannot reach the user. A third call per answer produces the proposed resume line and an optional follow-up question. Every field is length-clamped on the way out. The system prompt explicitly instructs the model to read uploaded text as evidence rather than instructions, never to invent metrics or scope, and never to treat a public project as proof of the candidate's ownership.
- **External services** — OpenAI, optional. The key is read from the server environment and never reaches the browser; the app asks a status endpoint whether a key exists and only then offers the checkbox. Candidate text is sent only after the user ticks it. With no key the endpoint refuses and the app says so plainly.
- **File map**
  - `src/App.jsx` — the entire UI and all state; every screen, panel, and dialog.
  - `src/lib/analyze.js` — the rule-based analyzer, sample case data, question plans, resume-change proposals.
  - `shared/career-ai.mjs` — the AI research and interview engine, its prompts, JSON handling, and citation filter.
  - `src/lib/ingest.js` — file and URL text extraction.
  - `src/lib/exporters.js` — DOCX, PDF, HTML, TXT output.
  - `shared/url-extract.mjs` — public-page fetching and safety limits, shared by dev server and production worker.
  - `worker/index.js` — production hosting: the API routes plus SPA fallback.
  - `src/career.css`, `src/styles.css` — styling.
  - `tests/sites-worker.test.mjs` — five hosting/API tests. `tests/career-ai.test.mjs` — three AI tests using a controlled fake response.
  - `AGENTS.md` — instructions left for coding agents working in this repo.

## 7. Rules of the house

Decisions that must not be reversed. Check every new request against these.

1. **Never state a claim the user hasn't confirmed they personally own.** Public company material and campaign pages are context, not proof of the candidate's contribution. This is the product's entire credibility, and it is written into the AI prompt as well as the UI.
2. **No invented metrics, ever.** A credible qualitative result beats a guessed number. Both the rule engine and the AI prompt enforce this.
3. **Nothing enters the resume without explicit approval.** Review-before-apply, editable wording, and undo are not optional polish.
4. **Manual user edits are protected.** Once the user has written their own wording, nothing overwrites it silently.
5. **One question in focus, but the full plan stays visible.** An earlier version hid the plan and the whole product read as a single-question demo.
6. **Only ask a question whose answer could improve the output.** Question count is a cost to the user, not a feature.
7. **The AI key lives server-side and never ships to the browser.** The app asks whether a key exists; it never handles one.
8. **Candidate text goes to the model only after the user explicitly opts in**, per session, with the choice visible on screen. No key means no call, ever.
9. **A public research finding is shown only if it carries a real citation.** Uncited items are discarded, not reworded into something vaguer.
10. **Uploaded text is evidence, not instructions.** Stated in the model's system prompt; keep it there, because sources are user-supplied documents and job posts.
11. **The UI must always say which mode is running.** Users must never have to guess whether they're getting live research or pattern matching.
12. **Show the user what was actually read.** The source stack and extracted-text views exist because a tool claiming to "do the homework" must prove it did.
13. **Finish is always available.** The user can leave with a usable document at any point.
14. **Carey is research context, not the target user**, and sample data stays visibly fictional.

## 8. Known gaps / not built yet

These are documented limits, not bugs to rediscover.

- **The AI path has never run against a real paid account.** It is implemented and covered by tests using a controlled fake response, but not exercised end to end with live billing. Treat first real use as a test.
- **No spend cap, no rate limit, no abuse protection on the AI endpoint.** Once a key is configured and the app is reachable, anyone who can load it can spend money, and each analysis makes multiple calls including web search. This breaks Danny's own standing rule that AI spend gets capped before launch, not after. Fix before the key goes anywhere near a deployed URL.
- **The public-page reader is not safe to expose publicly (SSRF).** It blocks unsafe addresses by *name* — rejecting `localhost`, `.local`, bare hostnames and raw IPs as text patterns. It never checks where a hostname actually points, so an ordinary-looking address resolving to a private or internal machine (or a cloud metadata endpoint) passes, and the app fetches it on the user's behalf. Redirects are followed and re-checked with the same weak test, after the request has gone out. Harmless running locally for one person; must be closed before public deployment, and the correct fix differs between the Node dev server and the Cloudflare Worker. Flagged by automated review Sep 17, 2026 and unchanged in this version.
- **Storage is one browser on one device.** No accounts, no encryption, no cross-device sync, no version history, no audit trail, no server-side deletion controls. Clearing site data wipes everything.
- **Resume parsing is lightweight.** Complex columns, tables, scanned PDFs, OCR, comments, tracked changes, and embedded media all need a production parser.
- **Link reading is limited.** Text-only; login walls, JavaScript-only pages, and robots restrictions will fail. Linked PDFs and Word files must be downloaded and uploaded manually.
- **Exports don't preserve the original layout.** They generate fresh documents from the approved draft.
- **Interview stories aren't built.** Draft screening answers exist in AI mode; prepared interview stories do not.
- **No claim-level citations on the resume itself.** Research is cited; individual resume claims are not traced back to a source.
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
