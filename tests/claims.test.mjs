import assert from "node:assert/strict";
import test from "node:test";
import { numbersIn, unsupportedNumbers } from "../shared/claims.mjs";

test("normalizes money, percent, multipliers, commas and number words", () => {
  assert.deepEqual([...numbersIn("Grew revenue 40% to $1.2M with 1,200 accounts, 3x faster, six reports")].sort(), ["$1200000", "1200", "3x", "40%", "6"].sort());
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

test("a bare number that looks like a year is still a figure without date context", () => {
  assert.deepEqual([...numbersIn("Reached 2000 customers and grew to 1999 users")].sort(), ["1999", "2000"]);
  assert.equal(numbersIn("Since 2021, led the team. March 2019. 2018–2021. BA Communications, 2015").size, 0);
});

test("spoken numbers: teens, tens, compounds, scales, dozen, double and triple", () => {
  assert.ok(numbersIn("sixteen engineers").has("16"));
  assert.ok(numbersIn("ninety percent").has("90%"));
  assert.ok(numbersIn("forty-two people").has("42"));
  assert.ok(numbersIn("a million users").has("1000000"));
  assert.ok(numbersIn("six million dollars").has("$6000000"));
  assert.ok(numbersIn("a dozen reports").has("12"));
  assert.ok(numbersIn("we doubled revenue").has("2x"));
});

test("units are not interchangeable: percent, money, multiplier and plain counts stay apart", () => {
  assert.deepEqual(unsupportedNumbers("Cut costs 40%", ["we had 40 projects"]), ["40%"]);
  assert.deepEqual(unsupportedNumbers("Managed $2000", ["2000 employees"]), ["$2000"]);
  assert.deepEqual(unsupportedNumbers("Cut costs 40%", ["cut costs forty percent"]), []);
  assert.deepEqual(unsupportedNumbers("Grew 3×", ["grew 3x"]), []);
  assert.deepEqual(unsupportedNumbers("Saved $1.2M", ["saved 1.2 million dollars"]), []);
});

test("full-width digits, grouped commas and letter-attached digits behave", () => {
  assert.ok(numbersIn("Grew ５０%").has("50%"));
  assert.deepEqual([...numbersIn("scores 5,10,15")].sort(), ["10", "15", "5"].sort());
  assert.equal(numbersIn("web3 and H2O and Q3").size, 0);
});
