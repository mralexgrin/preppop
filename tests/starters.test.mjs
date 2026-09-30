import { test } from "node:test";
import assert from "node:assert/strict";
import { STARTERS } from "../js/starters.js";
import { isSubject } from "../js/subjects.js";
import { SAFE_ID } from "../js/store.js";

test("starter decks are well-formed", () => {
  assert.equal(new Set(STARTERS.map((s) => s.id)).size, STARTERS.length, "unique ids");
  for (const s of STARTERS) {
    assert.match(s.id, SAFE_ID);
    assert.ok(isSubject(s.subject), `${s.id} has a real subject`);
    assert.ok(s.cards.length >= 10, `${s.id} has enough cards`);
    const terms = s.cards.map((c) => c.term.toLowerCase());
    assert.equal(new Set(terms).size, terms.length, `${s.id} has no duplicate terms`);
    for (const c of s.cards) assert.ok(c.term.trim() && c.definition.trim(), `${s.id}: every card has both sides`);
  }
});

test("there's a starter deck for each of her subjects", () => {
  const covered = new Set(STARTERS.map((s) => s.subject));
  for (const id of ["biology", "clinical", "spanish", "history", "english", "geometry"]) assert.ok(covered.has(id), id);
});
