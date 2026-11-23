import { test } from "node:test";
import assert from "node:assert/strict";
import { SCENARIOS, MAX_TURNS, scenarioById, reportLine } from "../js/shift.js";
import { SCENARIOS as SERVICE_SCENARIOS } from "../worker/src/index.js";

test("the app's scenarios match the answer service's", () => {
  assert.deepEqual(SCENARIOS.map((s) => s.id).sort(), Object.keys(SERVICE_SCENARIOS).sort());
  for (const s of SCENARIOS) assert.equal(s.title, SERVICE_SCENARIOS[s.id].title);
});

test("scenario lookup ignores unknown and prototype names", () => {
  assert.equal(scenarioById("fever").title, "Fever and cough");
  assert.equal(scenarioById("constructor"), null);
  assert.equal(scenarioById(undefined), null);
});

test("the report line is marked for the debrief", () => {
  assert.equal(reportLine("  Fever 101.8 and HR 108 "), "(Reporting to the doctor) Fever 101.8 and HR 108");
  assert.equal(MAX_TURNS, 14);
});
