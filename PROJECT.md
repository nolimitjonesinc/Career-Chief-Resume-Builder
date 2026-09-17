# Career Chief

**Last updated:** September 17, 2026
**Status:** Prototype
**Lives at:** local only — dev server at `localhost:5199`. Built to deploy to Cloudflare (Workers + static assets); no live URL confirmed in this folder. ‹CHECK› is there a deployed link?

> **Truth rule:** every line below must be verifiable in this project's own files.
> Anything inferred, assumed, or remembered gets marked **‹CHECK›** so Danny can
> confirm or kill it. A doc that guesses silently is worse than no doc.

---

## 1. What it is

Career Chief is a "chief of staff" for applying to a specific job. You bring your resume plus whatever material you have about the target company and role — files, pasted text, public web pages — and it shows you what it actually read, builds a hiring case for you, then interviews you one question at a time to fill the gaps. Every suggested resume change is shown to you for approval before it lands, and you can export the finished resume as Word, PDF, HTML, or plain text.

Right now it is a working interactive prototype. The flow is real and clickable end to end. The thinking behind it is rule-based pattern matching, not a connected AI model.

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
7. ‹CHECK› Not yet a goal in code: durable saved evidence reused across companies, and live automated research. Confirm these are in scope for the real build.

## 4. The mental model

One loop, run per opportunity:

```
SOURCES IN  →  ANALYZE  →  HIRING CASE  →  INTERVIEW  →  APPROVE  →  EXPORT
(files,        (map job    (fit, risk,     (one Q at     (review     (DOCX/PDF/
 paste,         language    what's          a time,       each        HTML/TXT)
 public URL)    to your     missing)        answers can   proposed
                evidence)                   spawn         resume
                                            follow-ups)   line)
                     ↑                                         │
                     └──── add more context, re-analyze ───────┘
```

Two ideas hold the whole product together:

- **Evidence, not keywords.** The analyzer only claims you have something if it can find it in your own material. Anything it can't find becomes a gap, and gaps become interview questions.
- **Nothing lands without approval.** Answers become proposed wording, shown next to the current line, editable, and applied only when you approve. Undo is always available.

The user can switch between two separate opportunity workspaces. Career evidence is shared between them; the hiring case, questions, and resume draft stay separate.

## 5. Feature list — what exists today

### Intake
- Upload and extract text from PDF, DOCX, HTML, TXT, Markdown, and RTF — all in the browser, nothing uploaded to a server.
- Paste unstructured text directly.
- Add a public HTTPS web page; a small server reader pulls its text, with URL validation plus size and timeout limits, and falls back to paste/upload when a page won't cooperate.
- Sources are categorized: resume, job description, application questions, company research, leadership, current role, career goals, other.
- A built-in fictional sample case (Jordan Avery / Nestwell) to walk the full experience without your own files.

### Analysis
- Maps explicit job-posting language against your supplied evidence across nine themes (creator program, community, editorial, social, acquisition, growth, trust, team leadership, brand strategy).
- Produces a visible summary: source count, character count, supported themes, gaps, hiring thesis, strongest fit, and a caution line naming what isn't established yet.
- Every source can be opened to read the exact extracted text used.
- Adding new context re-runs the analysis.

### Hiring case and research
- A hiring-case view with the thesis, requirement-by-requirement supported/unsupported status, and question count.
- A research view listing each opportunity source with its first finding and a plain-English strategic implication, plus an explicit warning not to treat public material as proof of personal ownership.

### Interview
- A prioritized question plan, always visible with progress, one question in focus at a time.
- Each question shows why it's being asked, a tip for answering, and (in the sample) an example answer.
- Six generic questions for your own material; a seven-question plan for the fictional sample.
- One genuinely answer-dependent follow-up: a specific ownership answer in the sample expands the plan from seven to eight questions.
- Questions can be skipped, and you can finish at any time.

### Resume control
- Working resume visible beside the reasoning from early on, not withheld until the end.
- Review-before-apply on every proposed change, with editable wording.
- Full direct editing of all nine resume sections.
- Undo history.
- Export to DOCX, PDF, HTML, and TXT.

### Craft
- Responsive layout, semantic controls, visible keyboard focus styles, native dialogs with focus restoration.
- Passed its own design QA against the source visual mock.

## 6. How it works underneath

- **Stack** — React 19 + Vite 6. Phosphor icons. Client-side extraction via pdfjs-dist (PDF) and mammoth (DOCX). Export via docx and jspdf. Deploys as a Cloudflare Worker serving static assets with SPA fallback.
- **Where data lives** — nowhere. Everything is React state in one component. There is no localStorage, no database, no accounts. **Refresh wipes the session**, including saved opportunity workspaces. This is confirmed by reading the code, not assumed.
- **The key mechanism** — a deterministic analyzer. It lowercases your career text and the job text, matches nine theme keywords against the job posting to decide what the role requires, then runs a regular-expression pattern per theme against your own material to decide whether you've evidenced it. Supported themes become strengths; unsupported ones become gaps and drive the caution line. Question selection is keyword and rule based. There is no language model anywhere in the product.
- **External services** — none. No API keys, no tokens, no credentials anywhere in the codebase (verified). The only network call is the app's own public-page reader endpoint.
- **File map**
  - `src/App.jsx` — the entire UI and all state; every screen, panel, and dialog.
  - `src/lib/analyze.js` — the analyzer, the sample case data, the question plans, and resume-change proposals. This is the product's brain.
  - `src/lib/ingest.js` — file and URL text extraction.
  - `src/lib/exporters.js` — DOCX, PDF, HTML, TXT output.
  - `shared/url-extract.mjs` — public-page fetching and safety limits, shared by dev server and production worker.
  - `worker/index.js` — production hosting: the extract endpoint plus SPA fallback.
  - `src/career.css`, `src/styles.css` — styling.
  - `tests/sites-worker.test.mjs` — five hosting/API tests.

## 7. Rules of the house

Decisions that must not be reversed. Check every new request against these.

1. **Never state a claim the user hasn't confirmed they personally own.** Public company material and campaign pages are context, not proof of the candidate's contribution. This is the product's entire credibility.
2. **No invented metrics, ever.** A credible qualitative result beats a guessed number. The code explicitly marks outcomes as qualitative when no evidence supports a figure.
3. **Nothing enters the resume without explicit approval.** Review-before-apply, editable wording, and undo are not optional polish.
4. **Manual user edits are protected.** Once the user has written their own wording, nothing overwrites it silently — the UI warns and still requires approval.
5. **One question in focus, but the full plan stays visible.** An earlier version hid the plan and the whole product read as a single-question demo. Do not hide the plan again.
6. **Only ask a question whose answer could improve the output.** Question count is a cost to the user, not a feature.
7. **The UI must never imply live AI or verified research while the analyzer is rule-based.** Prototype limits stay visible on screen.
8. **Show the user what was actually read.** The source stack and extracted-text views exist because a tool claiming to "do the homework" must prove it did.
9. **Finish is always available.** The user can leave with a usable document at any point.
10. **Carey is research context, not the target user.** The persona in the reference conversation is not the intended sole audience.
11. **Sample data stays visibly fictional.** Jordan Avery, Nestwell, and Harbor Studio are labeled fictional in the code and UI.

## 8. Known gaps / not built yet

These are documented limits, not bugs to rediscover.

- **No intelligence.** The analyzer is deterministic rule-matching. No language model is connected. Custom question selection is keyword based; only the fictional sample demonstrates genuinely adaptive depth.
- **No automated research.** The user must supply company, leadership, and role material themselves. There is no live search, no source URLs with retrieval dates, no verification, no confidence scoring, no citations.
- **Nothing survives a refresh.** No accounts, no storage, no encryption, no permissions, no deletion controls, no audit history, no version history.
- **No reusable evidence library.** Confirmed accomplishments can't be saved once and reused across companies — the user rebuilds their career each time.
- **Application package is incomplete.** No generated screening answers and no interview stories; resume output only.
- **Resume parsing is lightweight.** Complex columns, tables, scanned PDFs, OCR, comments, tracked changes, and embedded media all need a production parser.
- **Link reading is limited.** Text-only, and login walls, JavaScript-only pages, and robots restrictions will fail. Linked PDFs and Word files must be downloaded and uploaded manually.
- **Exports don't preserve the original layout.** They generate fresh documents from the approved draft.
- **Accessibility unverified.** Labels, focus styles, and semantics are in place, but keyboard order, screen-reader output, zoom reflow, and WCAG conformance were never confirmed by testing.
- **Only two opportunity workspaces**, and they're hardcoded sample projects.
- **Not under version control.** No git repo, so no history and no Status Brain snapshot.

## 9. Deeper history

Design and UX reasoning already captured in this folder:
- `PROTOTYPE.md` — what's genuinely functional, boundaries, and production acceptance criteria
- `ux-audit.md` — the pre-build audit, risks found, and recommendations
- `design-qa.md` — visual comparison against the source mock, findings and fixes

Build log: `../build-logs/logs/career-chief-prototype.md` — not created yet.
Reusable parts extracted from here: `../CAPABILITIES.md`
