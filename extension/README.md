# Save to Career Chief (browser extension, v1)

One click saves the job page you are viewing to Career Chief — including
pages that block automated readers (LinkedIn, Glassdoor), because the
extension reads the page inside your own browser, where you are already
looking at it.

## Load it (Chrome, unpacked — NOT published)

1. In this repo, use the `extension/` folder as-is. No build step.
2. Chrome → `chrome://extensions` → turn on **Developer mode** (top right).
3. **Load unpacked** → pick this `extension/` folder.
4. Click the extension icon → set the **Career Chief URL** field:
   - For testing a preview: paste the Vercel preview URL (e.g.
     `https://careerchiefresumebuilder-XXXX-....vercel.app/`).
   - For the live site: `https://careerchief.ai/` (the default).
   The URL is saved in the extension's own storage and remembered.

## Test it

1. Open any job page: a LinkedIn job, a Glassdoor job, or a company
   careers page (Greenhouse / Lever / etc.). On split-view search pages
   (Glassdoor / LinkedIn / Indeed search with a job open in the detail
   pane), one click saves the job in the pane — the tab title describes
   the search, so it is never used as the role. If the page is a search
   or listing with no single job in view, NO source is added at all:
   a search page's text is a list of other jobs, and adding it would
   pollute the analysis. The dock says so — click the job you want,
   then Save.
2. Click the extension icon → **Save this job**.
3. Career Chief opens in a new tab with the page saved as a job source.
   Role / company / description pre-fill only where the fields are empty
   — anything already typed stays untouched. Check them, fix anything
   that's off, then proceed as usual.
4. Saving the same job twice adds no second source — the dock says it
   is already in your sources. Saving two different jobs from the same
   search page adds both (they have different names).
5. A page with no readable text shows "This page has no readable text
   to save." Nothing is sent anywhere in that case.
6. Fresh installs show a note under the URL field while it still holds
   the untouched production default — a fresh install resets the saved
   URL, and Save then just opens the public site. Once any URL has been
   saved, the note never appears again.

## What it sends, and when

- ONLY when you click **Save this job**, on the tab you are viewing.
- Payload: page title, visible page text (capped at 50,000 chars, same
  cap as the server reader), the page URL, and any structured
  `JobPosting` data found on the page. Sent to Career Chief as a URL
  fragment (`#import=...`) — fragments are never sent to a server by
  the browser.
- No analytics, no tracking, no background reading, no data sent to
  any other destination.

## Permissions — why each one

- `activeTab`: run the extractor on the tab you clicked on, and only
  that tab. No access to any other tab, ever.
- `scripting`: inject the extractor into that one tab, on that one
  click. Nothing runs until you click.
- `storage`: remember the Career Chief URL you typed in the popup.

Deliberately NOT requested: `<all_urls>` / host permissions (the
extension must never be able to read pages unprompted), `tabs`
(browsing history), `cookies`, `webRequest`.

## Trust notes

- The app treats extension payloads exactly like pasted text: untrusted
  input, decoded and validated only, never executed. A malformed
  fragment is ignored — it can never crash the app or poison state.
- The job description field is filled ONLY from structured
  `JobPosting` data (≥80 chars). The visible page text becomes the
  evidence source, never the description field.
- Blocked pages stay blocked on the server side; the extension is the
  path for those pages because it reads what you are already viewing.

## NOT published

This is load-unpacked only. Publishing to the Chrome Web Store
(developer account, listing assets, review) is a separate decision —
say the word and it can be packaged for submission. Safari / iPhone
is a separate later step: it needs an App Store app wrapper, and it
cannot reach inside the LinkedIn app itself.
