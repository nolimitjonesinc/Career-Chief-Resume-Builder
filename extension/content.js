// Content script: runs ONLY when the user clicks "Save this job" in the
// popup, on the tab they are viewing. Gathers plain data from the DOM and
// hands it to the shared extractor (extension/extract.js, loaded first via
// chrome.scripting.executeScript files: ["extract.js", "content.js"]).
// The last expression is the payload — executeScript returns it.
// `doc: document` is passed through so the extractor can find the VIEWED
// job's detail pane on split-view pages (Glassdoor search with a job open
// in the pane) instead of trusting the tab title, which on those pages
// describes the search, not the job.
(function () {
  const api = self.CareerChiefExtract;
  const jsonLdTexts = Array.from(
    document.querySelectorAll('script[type="application/ld+json"]'),
  ).map((el) => el.textContent || "");
  return api.extractPageContent({
    title: document.title || "",
    innerText: document.body ? document.body.innerText : "",
    jsonLdTexts,
    url: window.location.href,
    doc: document,
  });
})();
