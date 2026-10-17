// Content script: runs ONLY when the user clicks "Save this job" in the
// popup, on the tab they are viewing. Gathers plain data from the DOM and
// hands it to the shared extractor (extension/extract.js, loaded first via
// chrome.scripting.executeScript files: ["extract.js", "content.js"]).
// The last expression is the payload — executeScript returns it.
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
  });
})();
