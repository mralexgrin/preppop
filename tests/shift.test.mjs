import { test } from "node:test";
import assert from "node:assert/strict";
import { scenarioById, reportLine } from "../js/shift.js";
// The scenarios are checked against the answer service in worker/test.

test("scenario lookup ignores unknown and prototype names", () => {
  assert.equal(scenarioById("fever").title, "Fever and cough");
  assert.equal(scenarioById("constructor"), null);
  assert.equal(scenarioById(undefined), null);
});

test("report text is trimmed", () => {
  assert.equal(reportLine("  Fever 101.8 and HR 108 "), "Fever 101.8 and HR 108");
});
