import { test } from "node:test";
import assert from "node:assert/strict";
import { parseList, detectSeparator } from "../js/import.js";

test("Quizlet-style tab export", () => {
  const { cards, sep } = parseList("hola\thello\nadiós\tgoodbye\n");
  assert.equal(sep, "tab");
  assert.deepEqual(cards, [
    { term: "hola", definition: "hello" },
    { term: "adiós", definition: "goodbye" },
  ]);
});

test("dash lists keep hyphens inside words", () => {
  const { cards, sep } = parseList("tachy- - fast\nbrady- – slow\nX-ray - imaging with radiation");
  assert.equal(sep, "dash");
  assert.deepEqual(cards[0], { term: "tachy-", definition: "fast" });
  assert.deepEqual(cards[1], { term: "brady-", definition: "slow" });
  assert.deepEqual(cards[2], { term: "X-ray", definition: "imaging with radiation" });
});

test("colon lists split on the first colon only", () => {
  const { cards } = parseList("Pulse: normal adult rate is 60-100 bpm\nRespirations: 12-20 breaths per minute");
  assert.deepEqual(cards[0], { term: "Pulse", definition: "normal adult rate is 60-100 bpm" });
});

test("strips numbering and bullets", () => {
  const { cards } = parseList("1. nucleus = holds DNA\n2) ribosome = makes proteins\n- vacuole = stores water");
  assert.deepEqual(
    cards.map((c) => c.term),
    ["nucleus", "ribosome", "vacuole"],
  );
});

test("swap puts definitions first", () => {
  const { cards } = parseList("hello - hola", { swap: true });
  assert.deepEqual(cards[0], { term: "hola", definition: "hello" });
});

test("reports lines it can't split", () => {
  const { cards, skipped } = parseList("a - b\nc - d\njust a heading\ne - f");
  assert.equal(cards.length, 3);
  assert.deepEqual(skipped, ["just a heading"]);
});

test("forced separator overrides detection", () => {
  const { cards } = parseList("Treaty of Versailles, 1919\nFall of Rome, 476", { sep: "comma" });
  assert.deepEqual(cards[1], { term: "Fall of Rome", definition: "476" });
});

test("no separator found", () => {
  assert.equal(detectSeparator(["hello", "world"]), null);
  const { cards, sep, skipped } = parseList("hello\nworld");
  assert.equal(sep, null);
  assert.equal(cards.length, 0);
  assert.equal(skipped.length, 2);
});

test("blank lines and Windows line endings are ignored", () => {
  const { cards } = parseList("a\tb\r\n\r\n\r\nc\td\r\n");
  assert.equal(cards.length, 2);
});
