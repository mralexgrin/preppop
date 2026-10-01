import { test } from "node:test";
import assert from "node:assert/strict";
import { state } from "../js/store.js";
import { reconcile } from "../js/cloud.js";

test("merged data is written into the deck and card objects screens already hold", () => {
  const card = { id: "c1", term: "old", definition: "d", status: "new" };
  const deck = { id: "d1", name: "Old name", cards: [card] };
  state.decks = [deck];
  const merged = [
    { id: "d1", name: "New name", updatedAt: 5, cards: [{ id: "c1", term: "edited", definition: "d", status: "known" }, { id: "c2", term: "new card", definition: "x", status: "new" }] },
    { id: "d2", name: "From the other device", cards: [] },
  ];
  const out = reconcile(merged);
  assert.equal(out[0], deck, "same deck object");
  assert.equal(out[0].cards[0], card, "same card object");
  assert.equal(deck.name, "New name");
  assert.equal(card.term, "edited");
  assert.equal(card.status, "known");
  assert.equal(deck.cards.length, 2);
  assert.equal(out[1].name, "From the other device");
});

test("fields removed by the merge don't linger on the old object", () => {
  const card = { id: "c1", term: "t", definition: "d", status: "learning", srs: { box: 0, due: "2026-09-30" } };
  state.decks = [{ id: "d1", name: "n", cards: [card] }];
  reconcile([{ id: "d1", name: "n", cards: [{ id: "c1", term: "t", definition: "d", status: "new" }] }]);
  assert.equal("srs" in card, false);
});
