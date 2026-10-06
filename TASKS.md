# Career Chief — Tasks

**Last updated:** October 6, 2026

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
- [ ] Accounts and cross-device storage so a career evidence bank isn't trapped in one browser. No longer a prerequisite for the paid tier (the Oct 4 license-key Pro unlock is per-browser by design); still needed for cross-device drafts and any recurring product
- [ ] Payments follow-ups (code done, dashboard live in test mode): three tiers exist (30-Day $29 / 1-Year $79 / Lifetime $149, license keys ON, activation limit 3) and the Pro dialog lists them via `VITE_LS_TIERS`. Still to do: run a test-mode purchase end to end, revoke/recreate the exposed LS API key, and complete business verification + payouts before flipping test mode off for live selling. Full checklist in `LEMON_SQUEEZY_SETUP.md`. Deliberately not built: accounts and cross-device licenses (the license is per-browser, like the draft), server-side enforcement of the gate (client-side is an honest paywall, not DRM)
- [ ] **Cover letter** as a second finished document, built from approved answers plus sources aimed at "my future cover letter"
- [ ] Draft resume lines straight from a deck (user approves each) instead of only through the interview
- [ ] Prepared interview stories to finish the application package (draft screening answers already exist)
- [ ] Get 10–20 real people through it and collect before/after examples and testimonials (blocked on the items above)

## Doing now
- [x] Oct 6: access gate is LIVE on careerchief.ai (code set in Vercel, redeployed, tried on the real site: stranger sees the code screen, wrong code refused, both codes work). Codes are saved in DJ's private key file. Still to do: shared store so the lockout holds across servers; key for AI not on the live site yet.
- [ ] Claude Haiku provider is merged to main (Claude Haiku provider, real resume headings, tailor-to-job, honesty guards, 116 tests pass). **Blocked on one thing:** add credits to the Anthropic account (Plans & Billing), then re-run the three-job live check once to confirm the last four guard fixes. Then merge or send back notes.
- [ ] Claude Haiku provider + tailor-to-job from branch `feature/claude-haiku` (committed Oct 5, merged Oct 6). Privacy policy must name Anthropic once live

## Done
- [x] Oct 6: access-code gate built, 114 checks pass, tried in a real browser (locked, wrong code, right code, refresh, changed code), merged to main Oct 6. Not switched on: needs the access code setting in Vercel.
- [x] Guided-tour copy finalized and pushed to main (Oct 2-5, 2026): "Every job gets its own resume. Updated. Custom tailored. For you." and "It tailors your evidence to the new role."
- [x] Payments and a free/paid boundary via Lemon Squeezy license keys (Oct 4, 2026) — no accounts, by decision: the license lives in the browser next to the draft. Free = interview, preview, editing, analysis. Pro = finished resume exports (DOCX/PDF/HTML/TXT), gated at `downloadResume`. Three one-time tiers (30-Day $29 / 1-Year $79 / Lifetime $149), all license-keyed, listed in the Pro dialog from `VITE_LS_TIERS`. Public License API (activate/validate/deactivate) from the browser, no secret in the client; fails closed to free; revalidates at most daily. "Go Pro" in the header and the Finish dialog; deactivation in the Pro dialog. Decision: Rule 13 ("finish is always available") means finishing the interview with the on-screen working draft — finished file exports are the paid boundary. Setup checklist for Danny in `LEMON_SQUEEZY_SETUP.md`
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
