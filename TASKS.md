# Career Chief — Tasks

**Last updated:** September 17, 2026

Read `PROJECT.md` before adding anything here. Tasks that break a "Rule of the
house" don't belong on this list.

Everything below comes from the documented gaps in `PROJECT.md` section 8 and the
production acceptance criteria in `PROTOTYPE.md`. Nothing here is invented.

## Next up
- [ ] **Before a key touches any environment, local included:** lock down the AI research endpoint — spend cap, rate limit, and a check on who is calling it. Currently open to anyone who can reach the app, and each analysis makes several calls including web search. Breaks the standing "cap spend before launch" rule
- [ ] **Decide the dev-server binding:** it currently answers the whole local network with the AI route exposed, so a key in the environment is spendable by anyone on the same wifi. Either refuse AI calls that did not originate on this machine, or bind locally by default — the wide binding looks intentional, so it is a choice to make, not a quiet edit
- [ ] Cap the size of the AI response before parsing it, matching what the link reader already does
- [ ] **Before any public deploy:** close the SSRF hole in the public-page reader — verify where a hostname actually resolves rather than pattern-matching its name, re-validate every redirect hop, and gate outbound requests on the Worker side
- [ ] First live run of the AI path against a real account — it has only ever run against a controlled fake response
- [ ] Hands-on interface check of browser-local autosave and switching between company applications
- [ ] Accounts and cross-device storage so a career evidence bank isn't trapped in one browser
- [ ] Prepared interview stories to finish the application package (draft screening answers already exist)

## Doing now
- [ ] Nothing in flight

## Done
- [x] Connect real AI research and an adaptive interview — opt-in, server-held key, cited findings only (Sep 17, 2026)
- [x] Make the working draft survive a refresh (Sep 17, 2026)
- [x] Reusable career evidence bank carried between company applications (Sep 17, 2026)
- [x] Dynamic company applications instead of two hardcoded sample workspaces (Sep 17, 2026)
- [x] Draft answers to supplied screening questions (Sep 17, 2026)

## Someday / maybe
Ideas that aren't committed.
- Claim-level citations tracing each resume line back to its source
- Production document parser: OCR, scanned PDFs, columns, tables, tracked changes
- Template-aware export that respects an uploaded resume's original layout
- Version history and protected-edit trail
- Verified accessibility pass: keyboard order, screen reader, zoom reflow, WCAG
- Encryption and deletion controls for stored career material
