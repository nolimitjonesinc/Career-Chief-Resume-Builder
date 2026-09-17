# Career Chief interactive prototype

This is a general career chief-of-staff experience informed by the supplied product handoff and Carey reference conversation. Carey is research context, not the intended sole user. Jordan Avery and Nestwell are fictional.

## Main experience

1. Bring a resume and target opportunity.
2. Upload PDF, DOCX, HTML, TXT, Markdown, or RTF; paste unstructured text; or add a public HTTPS page.
3. Add current responsibilities, application questions, company research, leadership context, career goals, and other permitted evidence.
4. Review a visible analysis of the source stack, role requirements, supported themes, gaps, hiring thesis, question count, and early resume.
5. Inspect the hiring case and the source text behind company and role findings.
6. Work through a prioritized interview plan one question at a time. The full plan and progress remain visible, and answers can create new follow-up questions.
7. Review each proposed resume change before applying it. Direct edits and undo remain available.
8. Create another company application, reusing the career evidence bank while keeping the target role, questions, and resume separate.
9. Finish at any time and export a new DOCX, PDF, HTML, or TXT resume.
10. Browser-local draft autosaves across refreshes; clear it from the source screen or career evidence panel.

## AI research connection

When a server-side `OPENAI_API_KEY` is configured, the intake offers an explicit AI-research checkbox. The candidate's source text is sent to OpenAI only after that option is selected. The server first researches a supplied company and target role using the Responses API `web_search` tool, then synthesizes a source-aware hiring thesis, specific question plan, open gaps, and preliminary application answers where actual screening questions were supplied. Public findings are displayed only when their URLs appear in the research response's citations. Each answer can yield a proposed resume line and one question worth following up. Proposed wording requires user approval.

Without a configured key, the app transparently uses its deterministic source analyzer and never calls the AI endpoint with candidate text. The working draft and exports still function. The deployed demo currently has no AI key and therefore runs in this fallback mode.

## What is genuinely functional

- Local client-side text extraction for PDF, DOCX, HTML, TXT, Markdown, and RTF files.
- A limited server-side reader for public HTTPS HTML, text, and JSON pages, with URL validation, size and timeout limits, and a paste/upload fallback.
- Deterministic source analysis that maps explicit job-language themes to supplied career evidence.
- A generic six-question plan for custom material and a seven-question fictional case for the richer Nestwell walkthrough; an AI-generated plan when connected and selected.
- An answer-dependent ownership follow-up that expands the sample plan from seven to eight questions.
- Source inspection, context reanalysis, evidence collection, proposal approval, full resume editing, undo, saved company opportunity drafts, and four real export formats.
- Responsive CSS, semantic controls, keyboard focus styles, and native dialog focus restoration.

## Important boundaries

- The hosted demo has no connected AI key. The optional research and adaptive interview route is implemented and covered by mocked API tests but has not been exercised end to end with a paid model account.
- Public-link reading depends on server network access and on the target page allowing a simple request. Login walls, JavaScript-only pages, robots restrictions, and restricted preview networks may require paste or file upload.
- Links read page text only. A linked PDF or Word document should be downloaded and uploaded.
- Exports create new documents from the approved draft. They do not preserve or modify the exact layout of an uploaded original.
- Resume parsing is deliberately lightweight. Complex columns, tables, scanned PDFs, OCR, comments, tracked changes, and embedded media need a production parser.
- The fallback does not search automatically. When the AI route is connected, company research uses the model's web search and displays cited links, but cannot guarantee that every strategic inference is correct.
- A browser-local draft survives refresh on the same device. It is not synchronized between devices and is not an encrypted account-backed career vault. Clearing site data also removes it.
- The resume remains a simplified parsed document. Each suggested claim is reviewable; the person is responsible for confirming it before application.
- Only share information the user is permitted to use. Do not treat source text or public campaigns as proof of personal ownership.

## Production acceptance criteria

Connect a server-held API key to exercise live AI research. Then add secure accounts and storage; robust OCR and document parsing; source-level claim citations and confidence; more reliable questions and resume-claim verification; cross-device per-company application workspaces; protected manual edits and version history; deletion controls; accessible mobile verification; and polished template-aware document export.

## Validation

Run `npm run build`, `npm run test:sites`, and `node --test tests/career-ai.test.mjs`. The AI tests use a controlled response and check the no-key boundary, cited-research filter, and answer-dependent follow-up. The earlier browser checks covered PDF/DOCX/HTML ingestion, combined analysis, the seven-question plan, proposal review, direct editing, Finish Now, and all four export formats. New browser-local persistence and dynamic company switching require a final interface check after deployment.
