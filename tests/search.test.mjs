import { test } from "node:test";
import assert from "node:assert/strict";
import { searchCards } from "../js/search.js";

const decks = [
  { id: "s", cards: [{ id: "1", term: "adiós", definition: "goodbye" }, { id: "2", term: "niño", definition: "boy" }] },
  { id: "m", cards: [{ id: "3", term: "brady-", definition: "slow", hint: "broody" }, { id: "4", term: "Bradycardia", definition: "slow heart rate" }] },
];

test("finds cards by term, definition, or hint, ignoring case and accents", () => {
  assert.deepEqual(searchCards(decks, "ADIOS").map((h) => h.card.id), ["1"]);
  assert.deepEqual(searchCards(decks, "nino").map((h) => h.card.id), ["2"]);
  assert.deepEqual(searchCards(decks, "broody").map((h) => h.card.id), ["3"]);
});

test("term matches come before definition matches", () => {
  assert.deepEqual(searchCards(decks, "slow").map((h) => h.card.id), ["3", "4"]);
  const ids = searchCards(decks, "brady").map((h) => h.card.id);
  assert.deepEqual(ids, ["3", "4"]);
  assert.deepEqual(searchCards(decks, "heart").map((h) => h.deck.id), ["m"]);
});

test("empty query finds nothing; results are capped", () => {
  assert.deepEqual(searchCards(decks, "  "), []);
  assert.equal(searchCards(decks, "o", 2).length, 2);
});
