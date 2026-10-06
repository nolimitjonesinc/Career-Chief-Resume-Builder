# Career Chief — Tasks

**Last updated:** October 5, 2026

Read `PROJECT.md` before adding anything here. Tasks that break a "Rule of the
house" don't belong on this list.

Everything below comes from the documented gaps in `PROJECT.md` section 8 and the
production acceptance criteria in `PROTOTYPE.md`. Nothing here is invented.

## Next up
- [ ] **Review and test branch `feature/trust-and-evidence`** (see `PLAN.md`, `IMPROVEMENTS.md`), then merge or send back notes. Rules 15 and 16 in `PROJECT.md` are proposed there and marked ‹CHECK›
- [ ] **Before a key touches a public URL:** bind a shared store as `env.AI_LIMIT_STORE` (Workers KV or a Durable Object) so the daily cap is a real cap. The interface exists; no adapter is written
- [ ] **First live run of the AI path** against a real account, behind the limits. Record the real cost of one plan and one answer check, then replace the estimated unit costs in `shared/config.mjs`. Judge whether the AI-mode questions are actually good: the "we know what to ask" pitch depends on it
- [ ] Verify the link reader's SSRF handling on the real Worker runtime (private-address refusal, DoH reachability) and decide whether a third-party resolver is acceptable
- [ ] Hands-on interface check of browser-local autosave and switching between company applications
- [ ] Accounts and cross-device storage so a career evidence bank isn't trapped in one browser. Prerequisite for any paid tier or recurring product
- [ ] Payments and a free/paid boundary (free: interview and preview; paid: complete resume and tailoring). Needs accounts first. Pricing numbers from outside reviews were guesses; set them after real cost per plan is known
  - Oct 5: Danny is filling out a Lemon Squeezy business form. A product description was drafted (nothing built or changed in the app). Pricing model not chosen yet ‹CHECK›. Next: draft the other form fields (business type, website, refund policy) if asked
- [ ] **Cover letter** as a second finished document, built from approved answers plus sources aimed at "my future cover letter"
- [ ] Draft resume lines straight from a deck (user approves each) instead of only through the interview
- [ ] Prepared interview stories to finish the application package (draft screening answers already exist)
- [ ] Get 10–20 real people through it and collect before/after examples and testimonials (blocked on the items above)

## Doing now
- [ ] Branch `feature/claude-haiku` is pushed and ready to review (Claude Haiku provider, real resume headings, tailor-to-job, honesty guards, 107 tests pass). **Blocked on one thing:** add credits to the Anthropic account (Plans & Billing), then re-run the three-job live check once to confirm the last four guard fixes. Then merge or send back notes.

## Done
- [x] Guided-tour copy finalized and pushed to main (Oct 2-5, 2026): "Every job gets its own resume. Updated. Custom tailored. For you." and "It tailors your evidence to the new role." Still unchecked: Vercel deploy shows Ready, and the longer first bubble on a phone ‹CHECK›
- [x] Safety layer: one `AI_ENABLED` gate for every runtime, origin check, per-caller and daily limits, response size cap, dev-server AI routes loopback-only, SSRF narrowed (feature branch, Oct 1, 2026)
- [x] Evidence ledger, live role coverage, own-words interview questions, 22 themes, Compare jobs, parse check, why-this-wording, optional AI "ask for a change", homepage before/after, saved-draft versioning (feature branch, Oct 1, 2026)
- [x] "Start new" button: new job keeping everything, or erase and start fresh; the first-screen clear link now confirms first (Sep 29, 2026)
- [x] Read PowerPoint decks (slides, speaker notes, tables, chart numbers) and let every source be aimed at current role / past / target role / cover letter; one interview question per deck (Sep 29, 2026)
- [x] Connect real AI research and an adaptive interview — opt-in, server-held key, cited findings only (Sep 17, 2026)
- [x] Make the working draft survive a refresh (Sep 17, 2026)
- [x] Reusable career evidence bank carried between company applications (Sep 17, 2026)
- [x] Dynamic company applications instead of two hardcoded sample workspaces (Sep 17, 2026)
- [x] Draft answers to supplied screening questions (Sep 17, 2026)

## Someday / maybe
Ideas that aren't committed.
- Better claim tracing (the ledger is approximate word overlap); AI-assisted matching
- Rank own-words questions by importance (recency, seniority) rather than by simple rules
- Real spend accounting from provider usage data instead of estimated units
- Shorter tab labels on phones (the fourth and fifth tabs sit behind a scroll)
- Production document parser: OCR, scanned PDFs, columns, tables, tracked changes
- Template-aware export that respects an uploaded resume's original layout
- Version history and protected-edit trail
- Verified accessibility pass: keyboard order, screen reader, zoom reflow, WCAG
- Encryption and deletion controls for stored career material
