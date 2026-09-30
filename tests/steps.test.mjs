import { test } from "node:test";
import assert from "node:assert/strict";
import { pickWindow, scoreOrder } from "../js/steps.js";

const cards = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}` }));

test("short decks are practiced whole", () => {
  const w = pickWindow(cards.slice(0, 5));
  assert.equal(w.start, 0);
  assert.equal(w.cards.length, 5);
});

test("long decks give a window of consecutive steps", () => {
  const w = pickWindow(cards, 8, () => 0.99);
  assert.equal(w.start, 4);
  assert.deepEqual(w.cards.map((c) => c.id), ["s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11"]);
  assert.equal(pickWindow(cards, 8, () => 0).start, 0);
});

test("scoreOrder marks each position", () => {
  const out = scoreOrder(["a", "c", "b", "d"], ["a", "b", "c", "d"]);
  assert.deepEqual(out.marks, [true, false, false, true]);
  assert.equal(out.correct, 2);
  assert.equal(out.total, 4);
});
