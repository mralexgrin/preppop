import { test } from "node:test";
import assert from "node:assert/strict";
import { makeBackup, makeDeckFile, readFile, mergeDecks, mergeActivity } from "../js/backup.js";

const deck = {
  id: "d1",
  name: "Vital signs",
  subject: "clinical",
  createdAt: 1,
  cards: [{ id: "c1", term: "Pulse", definition: "60-100 bpm", status: "known", srs: { box: 2, due: "2026-10-03", last: "2026-09-30" } }],
};
const state = { decks: [deck], activity: { "2026-09-30": { answered: 5, correct: 4 } }, settings: { dailyGoal: 30 }, distractors: {} };

test("a backup round-trips decks, progress, and settings", () => {
  const back = readFile(JSON.stringify(makeBackup(state)));
  assert.equal(back.kind, "backup");
  assert.deepEqual(back.decks[0].cards[0], deck.cards[0]);
  assert.equal(back.decks[0].id, "d1");
  assert.deepEqual(back.activity, state.activity);
  assert.equal(back.settings.dailyGoal, 30);
});

test("a shared deck has no personal progress and gets fresh ids", () => {
  const file = makeDeckFile(deck);
  assert.deepEqual(file.deck.cards, [{ term: "Pulse", definition: "60-100 bpm" }]);
  const back = readFile(JSON.stringify(file));
  assert.equal(back.kind, "deck");
  assert.notEqual(back.decks[0].id, "d1");
  assert.notEqual(back.decks[0].cards[0].id, "c1");
  assert.equal(back.decks[0].cards[0].status, "new");
  assert.equal(back.decks[0].cards[0].srs, undefined);
  assert.equal(back.decks[0].subject, "clinical");
});

test("rejects files that aren't PrepPop files", () => {
  assert.throws(() => readFile("not json"), /isn't a PrepPop/);
  assert.throws(() => readFile(JSON.stringify({ decks: [] })), /isn't a PrepPop/);
  assert.throws(() => readFile(JSON.stringify({ format: "preppop", kind: "weird" })), /isn't a PrepPop/);
  assert.throws(() => readFile(JSON.stringify({ format: "preppop", kind: "deck", deck: { cards: [] } })), /no cards/);
});

test("cleans hostile or broken content", () => {
  const evil = {
    format: "preppop",
    kind: "backup",
    decks: [
      {
        id: "x",
        name: "<img src=x onerror=alert(1)>",
        subject: "hacking",
        cards: [
          { term: "ok", definition: "fine", status: "admin", srs: { box: 99, due: "tomorrow" } },
          { term: "", definition: "no term" },
          { term: { nested: true }, definition: "bad type" },
        ],
      },
    ],
    activity: { "2026-09-30": { answered: "7", correct: 99 }, "not-a-day": { answered: 1 } },
    settings: { dailyGoal: 1e9, apiKey: "sk-evil" },
  };
  const back = readFile(JSON.stringify(evil));
  const d = back.decks[0];
  assert.equal(d.subject, "other");
  assert.equal(d.cards.length, 1);
  assert.equal(d.cards[0].status, "new");
  assert.equal(d.cards[0].srs, undefined);
  assert.deepEqual(back.activity, { "2026-09-30": { answered: 7, correct: 7 } });
  assert.deepEqual(back.settings, {});
  // The name is kept as text; views escape it when rendering.
  assert.equal(d.name, "<img src=x onerror=alert(1)>");
});

test("mergeDecks adds only decks that aren't already here", () => {
  const out = mergeDecks([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }]);
  assert.deepEqual(out.decks.map((d) => d.id), ["a", "b", "c"]);
  assert.equal(out.added, 1);
  assert.equal(out.skipped, 1);
});

test("mergeActivity keeps the larger count per day", () => {
  const out = mergeActivity({ d1: { answered: 5, correct: 5 }, d2: { answered: 1, correct: 0 } }, { d1: { answered: 3, correct: 3 }, d3: { answered: 2, correct: 1 } });
  assert.deepEqual(out, { d1: { answered: 5, correct: 5 }, d2: { answered: 1, correct: 0 }, d3: { answered: 2, correct: 1 } });
});

test("unsafe or duplicate ids from a file are replaced (XSS via attributes)", () => {
  const evil = {
    format: "preppop",
    kind: "backup",
    decks: [
      { id: 'x"><img src=x onerror=alert(1)>', name: "A", cards: [{ id: '"><b>', term: "t", definition: "d" }, { id: "same", term: "t2", definition: "d2" }, { id: "same", term: "t3", definition: "d3" }] },
      { id: "dup", name: "B", cards: [{ term: "t", definition: "d" }] },
      { id: "dup", name: "C", cards: [{ term: "t", definition: "d" }] },
    ],
    settings: { lastSubject: '"><script>alert(1)</script>' },
  };
  const back = readFile(JSON.stringify(evil));
  const safe = /^[A-Za-z0-9_-]{1,64}$/;
  for (const d of back.decks) {
    assert.match(d.id, safe);
    for (const c of d.cards) assert.match(c.id, safe);
  }
  assert.equal(new Set(back.decks.map((d) => d.id)).size, 3, "deck ids are unique");
  assert.equal(new Set(back.decks[0].cards.map((c) => c.id)).size, 3, "card ids are unique");
  assert.equal(back.settings.lastSubject, undefined);
});
