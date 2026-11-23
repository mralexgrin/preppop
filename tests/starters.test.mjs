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
    assert.ok(s.cards.length >= (s.ordered ? 5 : 9), `${s.id} has enough cards`);
    const terms = s.cards.map((c) => c.term.toLowerCase());
    assert.equal(new Set(terms).size, terms.length, `${s.id} has no duplicate terms`);
    for (const c of s.cards) assert.ok(c.term.trim() && c.definition.trim(), `${s.id}: every card has both sides`);
  }
});

test("there's a starter deck for each of her subjects", () => {
  const covered = new Set(STARTERS.map((s) => s.subject));
  for (const id of ["math", "science", "biology", "clinical", "spanish", "history", "social", "english", "geometry"]) assert.ok(covered.has(id), id);
});

test("ordered starter decks are flagged for Steps", () => {
  const ordered = STARTERS.filter((s) => s.ordered).map((s) => s.id);
  assert.ok(ordered.includes("handwashing") && ordered.includes("us-timeline"));
});

test("levels and starter decks match: every tagged deck can be offered in onboarding", async () => {
  const { LEVELS, startersFor } = await import("../js/starters.js");
  for (const level of LEVELS) {
    for (const s of STARTERS.filter((x) => x.levels.includes(level.id))) assert.ok(level.subjects.includes(s.subject), `${s.id} (${s.subject}) isn't offered for ${level.id}`);
    for (const subject of level.defaults) assert.ok(level.subjects.includes(subject), `${level.id} default ${subject} is offered`);
    assert.ok(startersFor(level.id, level.defaults).length >= 5, `${level.id} starts with some decks`);
  }
});

test("times tables never show the same answer twice", () => {
  const t = STARTERS.find((s) => s.id === "times-6-7-8");
  assert.equal(new Set(t.cards.map((c) => c.definition)).size, t.cards.length);
});

test("subject guesses for the new subjects", async () => {
  const { guessSubject } = await import("../js/subjects.js");
  assert.equal(guessSubject("Times tables 7s"), "math");
  assert.equal(guessSubject("Planets"), "science");
  assert.equal(guessSubject("Continents and oceans"), "social");
  assert.equal(guessSubject("Geometry basics"), "geometry");
});
