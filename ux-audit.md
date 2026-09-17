# UX audit before the expanded build

## Audit scope

The original prototype intake-to-interview flow was reviewed as an overwhelmed senior professional trying to use multiple sources to build a company-specific hiring case and resume.

## User goal and accessibility target

The user should be able to bring imperfect career and company material in common formats, understand what the system used, see a strong baseline early, answer a finite sequence of high-value questions, control every resume change, and finish at any time. The experience should remain keyboard-reachable, clearly labeled, and understandable without relying on color alone.

## Steps and health

1. Intake — unhealthy. Screenshot: `/workspace/scratch/career-chief-audit/01-current-intake.png`. The visual treatment was calm, but the product explicitly deferred PDF and Word extraction, a job link was only placeholder text, and custom inputs were described as UX-only.
2. Hiring case — mixed. Screenshot: `/workspace/scratch/career-chief-audit/02-current-interview.png`. The working resume and company-specific narrative appeared early, but the screen did not reveal how the uploaded material led to the case or how much work remained.
3. Interview — unhealthy. Captured DOM evidence showed one current prompt and no visible question plan. “One question at a time” was correctly interpreted as a presentation rule, but the prototype made it look like the entire product only had one useful question.
4. Resume control — mixed. Direct editing, review-before-apply, undo, and Finish Now were strengths, but only TXT export made the end state feel incomplete.

## Strengths

- Calm editorial hierarchy and reassuring copy suited an overwhelmed senior professional.
- The working resume appeared beside the reasoning instead of being delayed until the end.
- Review-before-apply, direct editing, undo, uncertainty, and Finish Now supported user control.

## UX risks

- Unsupported input formats contradicted the promise to do the homework first.
- Hidden interview depth made the experience feel scripted and shallow.
- Custom material did not visibly change the source map, hiring case, or questions.
- Research had no coherent source library tying facts to strategic implications.
- A TXT-only finish state did not match how professionals actually use resumes.

## Accessibility risks

- Screenshot evidence did not confirm keyboard order, zoom reflow, or screen-reader announcements.
- File inputs relied on custom labels and required browser testing to confirm chooser access.
- Progress through the interview was not exposed visually or semantically as a finite plan.

## Opportunity areas and recommendations

- Treat the intake as a source stack, with actual extraction status and format support.
- Show analysis stages and evidence categories before asking questions.
- Keep one question in focus while exposing the full prioritized plan and progress.
- Recompute the case and question plan when new context is added.
- Export practical documents in Word, PDF, HTML, and plain text.
- Keep prototype limits explicit so the UI does not imply live AI or verified research.

These recommendations were implemented in the expanded prototype. Remaining production boundaries are documented in `PROTOTYPE.md`.
