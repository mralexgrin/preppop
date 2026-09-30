import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAnswer, acceptedForms, editDistance, countsAsCorrect, needsAccentKeys } from "../js/answer.js";

const v = (input, expected) => checkAnswer(input, expected).verdict;

test("exact answers ignore case, punctuation, and spacing", () => {
  assert.equal(v("  Mitochondria. ", "mitochondria"), "correct");
  assert.equal(v("tachycardia!", "Tachycardia"), "correct");
  assert.equal(v("the  nucleus", "nucleus"), "correct");
});

test("leading article or 'to' doesn't matter", () => {
  assert.equal(v("eat", "to eat"), "correct");
  assert.equal(v("to eat", "eat"), "correct");
  assert.equal(v("perro", "el perro"), "correct");
  assert.equal(v("la casa", "casa"), "correct");
});

test("any listed alternative is accepted", () => {
  assert.equal(v("couch", "sofa / couch"), "correct");
  assert.equal(v("sofa", "sofa; couch"), "correct");
  assert.equal(v("platicar", "hablar or platicar"), "correct");
});

test("parenthesized words are optional", () => {
  assert.equal(v("eat", "(to) eat"), "correct");
  assert.equal(v("to eat", "(to) eat"), "correct");
  assert.equal(v("heart attack", "heart attack (myocardial infarction)"), "correct");
});

test("missing accents count, but are flagged", () => {
  assert.equal(v("adios", "adiós"), "accent");
  assert.equal(v("nino", "niño"), "accent");
  assert.equal(v("adiós", "adiós"), "correct");
  assert.equal(countsAsCorrect("accent"), true);
});

test("small typos are 'almost', bigger ones are wrong", () => {
  assert.equal(v("mitocondria", "mitochondria"), "almost");
  assert.equal(v("tachycarda", "tachycardia"), "almost");
  assert.equal(v("bradycardia", "tachycardia"), "wrong");
  assert.equal(v("cat", "car"), "wrong"); // short words must be exact
  assert.equal(countsAsCorrect("almost"), false);
});

test("empty input", () => {
  assert.equal(v("   ", "anything"), "empty");
});

test("acceptedForms and editDistance", () => {
  assert.ok(acceptedForms("(to) eat").includes("eat"));
  assert.equal(editDistance("kitten", "sitting"), 3);
  assert.equal(editDistance("", "abc"), 3);
});

test("accent keys offered for Spanish or accented answers", () => {
  assert.equal(needsAccentKeys("comer", "spanish"), true);
  assert.equal(needsAccentKeys("café", "english"), true);
  assert.equal(needsAccentKeys("nucleus", "biology"), false);
});
