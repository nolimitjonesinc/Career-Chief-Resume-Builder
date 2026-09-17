# Design QA Career Chief expanded experience

final result: passed

## Comparison target

- Source visual truth: `/workspace/scratch/93774cdc0f4b/generated_images/exec-61a0591e-fcc5-44e6-a6ae-5c33929967ec.png`
- Source pixels: 1485 by 1059.
- Implementation evidence: `/workspace/scratch/career-chief-interview-expanded-qa.jpg`
- Implementation pixels: 1348 by 926; CSS viewport 1363 by 936 at device pixel ratio 1.
- State: Nestwell fictional case, first interview question, unanswered, working resume visible.
- Normalization: both full desktop views were opened in the same comparison input and judged at fit-to-view scale. The source is approximately 10 percent wider and taller; findings ignore that density difference.

## Full-view comparison

The implementation preserves the source's warm ivory field, emerald action color, leaf brand, editorial Georgia headings, quiet sans-serif utility text, two-column interview and resume structure, thin dividers, generous white space, and persistent Finish action. It remains calm and professional while adding the source stack, opportunity navigation, research access, and visible question plan requested after the source mock was selected.

The principal composition difference is intentional: the source uses nearly the full left column for one question, while the implementation reserves a narrow rail for the complete seven-question plan. This reduces headline scale slightly but makes the experience legible as a real interview instead of a single scripted question. No yes/maybe/no chips or unsupported illustrative metrics appear.

## Focused comparison

- Typography: Georgia and Arial fallbacks preserve the editorial/display and restrained utility hierarchy. Heading wrap, weight, and line height remain optically close to the source; the smaller question heading is required by the visible plan rail.
- Spacing and layout: the 1.45 to 1 workspace grid keeps the resume secondary but continuously visible. Question rail, form, and resume do not overlap at the tested desktop viewport.
- Colors and tokens: emerald, muted blue-gray, pale green, ivory, and fine gray borders match the source intent. Disabled export and interview states remain visibly distinct.
- Image quality and assets: the target contains no raster imagery. The Phosphor leaf, target, file, source, and action icons are consistent and no custom SVG, CSS drawing, emoji, gradient, or placeholder image substitutes are used.
- Copy and content: product copy stands alone, explains evidence status, exposes the full plan and progress, and does not imply live AI or verified research.
- Accessibility visible from the implementation: labels, native buttons, native dialogs, focus outlines, status regions, disabled states, and semantic navigation are present. Screenshot evidence cannot establish full keyboard order, screen-reader output, zoom, or WCAG conformance.

## Comparison history

### Initial implementation findings

- P1: intake explicitly deferred PDF and Word extraction and custom material did not affect strategy.
- P1: the interview exposed one current question without a visible plan, so it read as a single-question demo.
- P2: Finish exported only TXT and did not satisfy the expected Word, PDF, or HTML continuation.

### Fixes made

- Added real PDF, DOCX, HTML, TXT, Markdown, and RTF extraction and a limited public-page reader.
- Added source categories, source stack, analysis summary, source evidence views, and context reanalysis.
- Added a visible seven-question sample plan, six-question generic plan, progress, skip/unknown paths, and answer-dependent follow-up insertion.
- Added reviewed resume proposals, direct full-document editing, undo, separate company workspaces, and actual DOCX, PDF, HTML, and TXT export creation.
- Reworked baseline resume parsing so current experience, earlier experience, and education render in the correct sections.

### Post-fix evidence

- `/workspace/scratch/career-chief-interview-expanded-qa.jpg` shows the complete plan, one high-value question, working resume, opportunity context, Add context, and Finish action together.
- `/workspace/scratch/career-chief-intake-sources-qa.jpg` shows the expanded intake with PDF, Word, HTML, paste, job link, job file, and seven-source sample stack.
- PDF, DOCX, and HTML fixture files were visibly inspected before browser ingestion tests.

## Primary interactions tested

- PDF, DOCX, and HTML uploads extracted readable text and appeared as ready sources.
- A public-link fetch path and fallback were exercised; the worker extraction path passes a mocked public-page test, while the restricted local preview could not reach an external page.
- Four supplied sources produced a six-question custom plan and early editable resume.
- The Nestwell sample produced a seven-question plan; the first answer created an eighth question specifically about personal ownership.
- Proposed wording required explicit approval and did not invent a metric.
- All resume sections were editable and the manual title edit appeared immediately.
- Harbor Studio opened as a separate generic analysis and retained its own draft state.
- Finish Now remained available before interview completion.
- DOCX, PDF, HTML, and TXT export functions each reached their success state; downloaded TXT content was inspected.
- Browser console errors were checked. Observed errors came from the cloud-browser metadata extension, not the app.
- Build and five hosting/API tests pass.

## Residual test gaps

- Browser-level mobile viewport capture was not available in the selected cloud-browser API. Responsive breakpoints were implemented but are not claimed as visually verified.
- External job-link success could not be demonstrated in this restricted preview network. The same endpoint passes with a controlled public-page response and the UI provides paste and upload fallback.
- Complex scanned PDFs, legacy `.doc`, multi-column resumes, and preservation of original document formatting remain production work.

No actionable P0, P1, or P2 visual mismatch remains within the tested desktop prototype scope. The added workflow density is an intentional product change requested by the user, not unplanned design drift.
