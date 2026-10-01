import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQuestions, wrongAnswersFor, makeTrueFalse } from "../js/testbuilder.js";

const cards = Array.from({ length: 30 }, (_, i) => ({ id: `c${i}`, term: `term ${i}`, definition: `definition ${i}` }));

test("asks the chosen number of questions, each card at most once", () => {
  const qs = buildQuestions(cards, { count: 10, mode: "term", types: ["choice"] });
  assert.equal(qs.length, 10);
  assert.equal(new Set(qs.map((q) => q.card.id)).size, 10);
  assert.ok(qs.every((q) => q.shows === "term" && q.prompt === q.card.term && q.answer === q.card.definition));
});

test("count larger than the deck asks every card", () => {
  assert.equal(buildQuestions(cards.slice(0, 4), { count: 20, mode: "term", types: ["choice"] }).length, 4);
});

test("question types are spread evenly", () => {
  const qs = buildQuestions(cards, { count: 30, mode: "definition", types: ["choice", "written", "truefalse"] });
  const counts = qs.reduce((m, q) => ((m[q.type] = (m[q.type] ?? 0) + 1), m), {});
  assert.deepEqual(counts, { choice: 10, written: 10, truefalse: 10 });
  assert.ok(qs.every((q) => q.prompt === q.card.definition));
});

test("mix shows both sides", () => {
  let flip = 0;
  const rand = () => (flip++ % 2 ? 0.9 : 0.1);
  const qs = buildQuestions(cards, { count: 4, mode: "mix", types: ["choice"] }, rand);
  assert.ok(qs.some((q) => q.shows === "term") && qs.some((q) => q.shows === "definition"));
});

test("wrong answers prefer Claude's, skip duplicates of the right answer, fall back to the deck", () => {
  const q = { shows: "term", answer: "definition 0" };
  assert.deepEqual(wrongAnswersFor(q, ["AI one", "Definition 0", "AI two"], []), ["AI one", "AI two"]);
  const fallback = wrongAnswersFor(q, [], cards.slice(0, 5));
  assert.equal(fallback.length, 3);
  assert.ok(!fallback.includes("definition 0"));
});

test("true/false shows the real answer or a wrong one", () => {
  const q = { answer: "right" };
  assert.deepEqual(makeTrueFalse(q, ["wrong"], () => 0.1), { statement: "right", isTrue: true });
  assert.deepEqual(makeTrueFalse(q, ["wrong"], () => 0.9), { statement: "wrong", isTrue: false });
  assert.deepEqual(makeTrueFalse(q, [], () => 0.9), { statement: "right", isTrue: true });
});
