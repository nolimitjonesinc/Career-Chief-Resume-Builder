# Career Chief interactive prototype

This is a general career chief-of-staff experience informed by the supplied product handoff and Carey reference conversation. Carey is research context, not the intended sole user. Jordan Avery, Nestwell, Harbor Studio, and their research are fictional.

## Main experience

1. Bring a resume and target opportunity.
2. Upload PDF, DOCX, HTML, TXT, Markdown, or RTF; paste unstructured text; or add a public HTTPS page.
3. Add current responsibilities, application questions, company research, leadership context, career goals, and other permitted evidence.
4. Review a visible analysis of the source stack, role requirements, supported themes, gaps, hiring thesis, question count, and early resume.
5. Inspect the hiring case and the source text behind company and role findings.
6. Work through a prioritized interview plan one question at a time. The full plan and progress remain visible, and answers can create new follow-up questions.
7. Review each proposed resume change before applying it. Direct edits and undo remain available.
8. Switch between two opportunity workspaces with separate resume drafts and question progress.
9. Finish at any time and export a new DOCX, PDF, HTML, or TXT resume.

## What is genuinely functional

- Local client-side text extraction for PDF, DOCX, HTML, TXT, Markdown, and RTF files.
- A limited server-side reader for public HTTPS HTML, text, and JSON pages, with URL validation, size and timeout limits, and a paste/upload fallback.
- Deterministic source analysis that maps explicit job-language themes to supplied career evidence.
- A generic six-question plan for custom material and a seven-question fictional case for the richer Nestwell walkthrough.
- An answer-dependent ownership follow-up that expands the sample plan from seven to eight questions.
- Source inspection, context reanalysis, evidence collection, proposal approval, full resume editing, undo, separate sample opportunity drafts, and four real export formats.
- Responsive CSS, semantic controls, keyboard focus styles, and native dialog focus restoration.

## Important boundaries

- The analyzer is deterministic, not a connected language model. It demonstrates the product workflow and evidence safeguards; it does not provide production-quality semantic reasoning.
- Public-link reading depends on server network access and on the target page allowing a simple request. Login walls, JavaScript-only pages, robots restrictions, and restricted preview networks may require paste or file upload.
- Links read page text only. A linked PDF or Word document should be downloaded and uploaded.
- Exports create new documents from the approved draft. They do not preserve or modify the exact layout of an uploaded original.
- Resume parsing is deliberately lightweight. Complex columns, tables, scanned PDFs, OCR, comments, tracked changes, and embedded media need a production parser.
- Research is not performed automatically. The user can supply public pages and see extracted text; production needs live search, source URLs, excerpts, dates, verification, and uncertainty.
- Custom question selection is keyword- and rule-based. The sample demonstrates richer adaptive behavior; production needs model reasoning across all evidence and answers.
- Refresh clears the session. Authentication, durable storage, deletion controls, encryption, permissions, and audit history are not connected.
- Only share information the user is permitted to use. Do not treat source text or public campaigns as proof of personal ownership.

## Production acceptance criteria

Add secure accounts and storage; robust OCR and document parsing; live company, CEO, hiring-manager, financial, trajectory, and role research; source-level citations and confidence; true answer-aware question generation; durable per-company application workspaces; protected manual edits and version history; direct corrections and deletion; accessible mobile verification; and polished template-aware document export.

## Validation

`npm run build` and `npm run test:sites` pass. Five hosting/API tests cover static assets, SPA fallback, API behavior, public-page extraction, and packaging. Browser checks covered PDF/DOCX/HTML ingestion, combined analysis, the seven-question plan, adaptive follow-up, proposal review, direct resume editing, separate opportunity workspaces, Finish Now, and DOCX/PDF/HTML/TXT export generation.
