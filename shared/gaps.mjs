// Words that mean a line is confessing a gap, describing a plan instead of work
// done, or talking about willingness. None of that belongs on a resume. Used by
// the server (to refuse AI wording) and by the page (to refuse a raw denial).
const GAP_WORDS = /development area|learning area|requires? new learning|\bunproven\b|\blacks?\b|\bdid not\b|\bdidn't\b|\bhave not\b|\bhas not\b|\bhaven't\b|\bhadn't\b|\bnever (?:have|had|did|worked|run|owned|managed)\b|no direct experience|\bremains? (?:a )?gap\b|\backnowledg\w*|\bwilling(?:ness)?\b|\bcommitment to (?:learn|grow|develop)|\bready to (?:deepen|learn|develop|grow)|\bexpertise gaps?\b|\bclose (?:the )?(?:category |expertise )?gaps?\b|\boutside (?:of )?(?:my |the |his |her |their )?(?:current )?scope\b|\bi would\b|\bwould approach\b|\bplan(?:s|ned)? to\b|\bintend(?:s|ed)? to\b|\bdeepen\b|\bno (?:direct )?(?:ownership|experience|exposure|background)\b|\bwithout (?:direct )?(?:ownership|experience)\b|\bnot (?:yet )?(?:responsible|owned|an owner)\b|\b(?:cannot|can't|unable to|not able to) (?:rule out|confirm|verify|prove|isolate)|\b(?:though|although|however|despite)\b/i;

export const looksLikeGap = (text) => GAP_WORDS.test(String(text || ""));

// Rank words the person never used about themselves. A summary that calls an
// associate-level marketer a "director-track leader" is inflation, not tailoring.
const RANK = /\b(director|head of|vice president|vp|chief|executive|principal|leader|founder)\b/gi;
export function inflatedTitles(text, support = []) {
  const have = support.join("\n").toLowerCase();
  return [...new Set((String(text || "").match(RANK) || []).map((word) => word.toLowerCase()))].filter((word) => !have.includes(word));
}

// Share of a line's meaningful words that appear nowhere in what the person said.
// A faithful rewording scores low; an invented method or activity scores high.
const FILLER = new Set("which would could should about their there these those through during between across where while being having after before other under over into from with that this have been were what when your".split(" "));
const stem = (word) => word.replace(/(ing|ed|es|ly|s)$/, "");
const bag = (text) => (String(text || "").toLowerCase().match(/[a-z]{5,}/g) || []).filter((word) => !FILLER.has(word)).map(stem);
export function novelShare(text, support = []) {
  const have = new Set(bag(support.join(" ")));
  const mine = [...new Set(bag(text))];
  // A very short line is judged by the figure check instead; one new word would swing the share too far.
  return mine.length >= 6 ? mine.filter((word) => !have.has(word)).length / mine.length : 0;
}
