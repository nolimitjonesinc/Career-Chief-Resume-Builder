import assert from "node:assert/strict";
import test from "node:test";
import { inflatedTitles, looksLikeGap } from "../shared/gaps.mjs";

test("denials, plans and willingness are gap talk; achievements are not", () => {
  for (const line of ["No, I haven't worked in healthcare.", "I did not own sales enablement.", "Pricing is a development area.", "Ready to deepen product expertise.", "I would approach it with interviews.", "Acknowledged the gap.", "No direct ownership of retention metrics.", "Without direct experience in churn analysis."]) assert.equal(looksLikeGap(line), true, line);
  for (const line of ["Cut cost per lead 22%.", "Led a team of four marketers.", "Launched six feature launches with sales and product.", "Built the learning program for new hires."]) assert.equal(looksLikeGap(line), false, line);
});

test("rank words the person never used are flagged", () => {
  const support = ["Senior Marketing Manager, Brightwave", "Lead a team of four"];
  assert.deepEqual(inflatedTitles("Marketing leader and director-track operator", support).sort(), ["director", "leader"]);
  assert.deepEqual(inflatedTitles("Senior marketer who leads a team", support), []);
  assert.deepEqual(inflatedTitles("Former director of marketing", ["Director of Marketing, Acme"]), []);
});

import { novelShare } from "../shared/gaps.mjs";
const said = ["I designed and launched the onboarding email series at Brightwave. Trial-to-paid conversion went from 14% to 17% over two quarters, and I ran the A/B tests on subject lines and timing."];

test("a faithful rewording scores low and an invented method scores high", () => {
  assert.ok(novelShare("Designed and launched onboarding email series at Brightwave, improving trial-to-paid conversion from 14% to 17% over two quarters through A/B testing of subject lines and send timing.", said) < 0.35);
  assert.ok(novelShare("Lifted conversion from 14% to 17% through A/B testing of subject lines; isolated email as primary driver via sequential testing with control groups, though cannot rule out concurrent product or sales changes during the two-quarter window.", said) > 0.35);
});

test("hedges are gap talk", () => {
  assert.equal(looksLikeGap("Lifted conversion 3 points, though cannot rule out other changes."), true);
  assert.equal(looksLikeGap("Lifted conversion 3 points with A/B tests."), false);
});
