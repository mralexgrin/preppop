import { test } from "node:test";
import assert from "node:assert/strict";
import { guessSubject, subjectOf, SUBJECTS } from "../js/subjects.js";

test("guesses subjects from typical deck names", () => {
  assert.equal(guessSubject("Spanish verbs ch. 3"), "spanish");
  assert.equal(guessSubject("Medical terminology prefixes"), "clinical");
  assert.equal(guessSubject("Vital signs"), "clinical");
  assert.equal(guessSubject("Cell biology unit 2"), "biology");
  assert.equal(guessSubject("World War II"), "history");
  assert.equal(guessSubject("Triangle theorems"), "geometry");
  assert.equal(guessSubject("SAT vocab"), "english");
  assert.equal(guessSubject("Stuff"), null);
});

test("subjectOf falls back to Other", () => {
  assert.equal(subjectOf({ subject: "biology" }).name, "Biology");
  assert.equal(subjectOf({ subject: "nope" }).id, "other");
  assert.equal(subjectOf(undefined).id, "other");
  assert.equal(SUBJECTS.at(-1).id, "other");
});
