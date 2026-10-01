import assert from "node:assert/strict";
import test from "node:test";
import { numbersIn, unsupportedNumbers } from "../shared/claims.mjs";

test("normalizes money, percent, multipliers, commas and number words", () => {
  assert.deepEqual([...numbersIn("Grew revenue 40% to $1.2M with 1,200 accounts, 3x faster, six reports")].sort(), ["1200000", "1200", "3x", "40%", "6"].sort());
});

test("years are not performance claims", () => {
  assert.equal(numbersIn("Rivermark Health, 2021–present, BA 2015").size, 0);
});

test("flags a figure the user never supplied", () => {
  const unsupported = unsupportedNumbers("Increased signups 35% across 4 regions.", ["I increased signups by 35%.", "Resume text"]);
  assert.deepEqual(unsupported, ["4"]);
});

test("a number word in the answer supports a digit in the line", () => {
  assert.deepEqual(unsupportedNumbers("Led 6 direct reports.", ["I led six direct reports."]), []);
});

test("1,000 and 1000 and 1k and $1.2M and 1,200,000 are the same claim", () => {
  assert.deepEqual(unsupportedNumbers("Reached 1,000 users", ["about 1000 users"]), []);
  assert.deepEqual(unsupportedNumbers("Reached 1k users", ["about 1000 users"]), []);
  assert.deepEqual(unsupportedNumbers("Saved $1.2M", ["we saved 1,200,000 dollars"]), []);
});
