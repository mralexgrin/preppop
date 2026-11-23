import { test } from "node:test";
import assert from "node:assert/strict";
import { findMixup, noteMixup, easeMixup, easePair, mixupPairs, partnerOf, pairDrill, mixupMessage, MAX_COUNT } from "../js/mixups.js";
import { migrate, recordAnswer } from "../js/store.js";
import { grade } from "../js/srs.js";
import { mergeState } from "../js/sync.js";
import { cleanSyncData } from "../js/backup.js";
import { wrongAnswersFor } from "../js/testbuilder.js";
import { calibration, blindSpots, isOverconfident } from "../js/progress.js";

const makeDeck = () => ({
  id: "d1",
  subject: "clinical",
  cards: [
    { id: "tachy", term: "Tachycardia", definition: "Heart rate over 100 bpm" },
    { id: "brady", term: "Bradycardia", definition: "Heart rate under 60 bpm" },
    { id: "apnea", term: "Apnea", definition: "No breathing" },
  ],
});

test("findMixup: a picked option that is another card's answer", () => {
  const deck = makeDeck();
  const [tachy, brady] = deck.cards;
  assert.equal(findMixup(deck, tachy, "definition", "Heart rate under 60 bpm"), brady);
  assert.equal(findMixup(deck, tachy, "definition", "Heart rate under 50 bpm"), null); // an AI distractor
  assert.equal(findMixup(deck, tachy, "definition", ""), null);
});

test("findMixup: typed answers are matched leniently, like grading", () => {
  const deck = makeDeck();
  const [tachy, brady] = deck.cards;
  assert.equal(findMixup(deck, tachy, "term", "bradycardia", { typed: true }), brady);
  assert.equal(findMixup(deck, tachy, "term", "Bradicardia", { typed: true }), null); // a typo isn't a confident mix-up
});

test("findMixup ignores cards with the same answer text as this one", () => {
  const deck = makeDeck();
  deck.cards.push({ id: "tachy2", term: "Fast heart", definition: "Heart rate over 100 bpm" });
  assert.equal(findMixup(deck, deck.cards[0], "definition", "Heart rate over 100 bpm"), null);
});

test("findMixup skips cards that show the same prompt (an ambiguous question)", () => {
  const deck = { cards: [{ id: "a", term: "banco", definition: "bank" }, { id: "b", term: "banco", definition: "bench" }] };
  assert.equal(findMixup(deck, deck.cards[0], "definition", "bench"), null);
});

test("pairs the drill can't ask about aren't listed, and prototype names are just ids", () => {
  const deck = { id: "d", cards: [
    { id: "a", term: "banco", definition: "bank", mixups: { b: 2 } },
    { id: "b", term: "banco", definition: "bench" },
    { id: "constructor", term: "C", definition: "3" },
  ] };
  assert.deepEqual(mixupPairs([deck]), []);
  assert.equal(partnerOf(deck, deck.cards[2]), null);
  noteMixup(deck.cards[0], deck.cards[2]);
  assert.equal(deck.cards[0].mixups.constructor, 1);
});

test("noteMixup counts up to a cap; easeMixup counts down and cleans up", () => {
  const card = { id: "a" };
  for (let i = 0; i < 12; i++) noteMixup(card, { id: "b" });
  assert.equal(card.mixups.b, MAX_COUNT);
  card.mixups = { b: 2 };
  easeMixup(card, "b");
  assert.deepEqual(card.mixups, { b: 1 });
  easeMixup(card, "b");
  assert.equal("mixups" in card, false);
  easeMixup(card, "b"); // nothing to ease
  assert.equal("mixups" in card, false);
});

test("easePair eases whichever side recorded the mix-up", () => {
  const a = { id: "a" };
  const b = { id: "b", mixups: { a: 1 } };
  easePair(a, b);
  assert.equal("mixups" in b, false);
});

test("mixupPairs lists each pair once with both directions added up", () => {
  const deck = makeDeck();
  const [tachy, brady, apnea] = deck.cards;
  tachy.mixups = { brady: 2 };
  brady.mixups = { tachy: 1 };
  apnea.mixups = { gone: 3 }; // a deleted card is ignored
  const pairs = mixupPairs([deck]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].count, 3);
  assert.deepEqual(new Set([pairs[0].a.id, pairs[0].b.id]), new Set(["tachy", "brady"]));
});

test("partnerOf finds the most confused card in either direction", () => {
  const deck = makeDeck();
  const [tachy, brady, apnea] = deck.cards;
  brady.mixups = { tachy: 1 };
  apnea.mixups = { tachy: 3 };
  assert.equal(partnerOf(deck, tachy), apnea);
  assert.equal(partnerOf(deck, brady), tachy);
  assert.equal(partnerOf(makeDeck(), makeDeck().cards[0]), null);
});

test("pairDrill asks both cards of each pair, with the two terms as options", () => {
  const deck = makeDeck();
  const [tachy, brady] = deck.cards;
  const qs = pairDrill([{ deck, a: tachy, b: brady }]);
  assert.equal(qs.length, 2);
  for (const q of qs) assert.deepEqual(new Set(q.options), new Set(["Tachycardia", "Bradycardia"]));
  assert.deepEqual(new Set(qs.map((q) => q.card.id)), new Set(["tachy", "brady"]));
  // Two cards with the same term can't be told apart by term, so they're skipped.
  assert.equal(pairDrill([{ deck, a: tachy, b: { ...brady, term: "tachycardia" } }]).length, 0);
});

test("mixupMessage names the other card and escapes it", () => {
  assert.equal(mixupMessage({ term: "<b>", definition: "x" }, "definition"), "That's the definition of <strong>&lt;b&gt;</strong>.");
  assert.match(mixupMessage({ term: "Brady", definition: "Heart rate under 60" }, "term"), /<strong>Brady<\/strong> is a different card: Heart rate under 60/);
  assert.ok(mixupMessage({ term: "x", definition: "y".repeat(200) }, "term").endsWith("…"));
});

test("Test mode offers the card she's mixed up with as one of the wrong answers", () => {
  const deck = makeDeck();
  const q = { shows: "term", answer: "Heart rate over 100 bpm" };
  const wrong = wrongAnswersFor(q, ["A", "B", "C"], deck.cards, "Heart rate under 60 bpm");
  assert.deepEqual(wrong, ["Heart rate under 60 bpm", "A", "B"]);
});

test("migrate keeps only mix-ups that point at other cards in the same deck", () => {
  const out = migrate({
    decks: [
      {
        id: "d1",
        cards: [
          { id: "a", term: "A", definition: "1", mixups: { b: 2, a: 1, zz: 1, "bad id": 1, c: 0 } },
          { id: "b", term: "B", definition: "2", mixups: { a: 40 } },
          { id: "c", term: "C", definition: "3", mixups: "junk" },
        ],
      },
    ],
  });
  const [a, b, c] = out.decks[0].cards;
  assert.deepEqual(a.mixups, { b: 2 });
  assert.deepEqual(b.mixups, { a: 9 });
  assert.equal("mixups" in c, false);
});

test("guessed right doesn't count as known: same box, back tomorrow", () => {
  const card = { status: "known", srs: { box: 3, due: "2026-11-20" } };
  assert.deepEqual(grade(card, true, "2026-11-23", null, { guessed: true }), { status: "learning", srs: { box: 3, due: "2026-11-24", last: "2026-11-23" } });
  // Not due for weeks: a lucky guess still brings it back tomorrow.
  const later = { status: "known", srs: { box: 5, due: "2026-12-20" } };
  assert.deepEqual(grade(later, true, "2026-11-23", "2026-12-01", { guessed: true }), { status: "learning", srs: { box: 5, due: "2026-11-24", last: "2026-11-23" } });
  assert.equal(grade({ status: "new" }, true, "2026-11-23", null, { guessed: true }).status, "learning");
  // Wrong is wrong, guessing or not.
  assert.equal(grade(card, false, "2026-11-23", null, { guessed: true }).srs.box, 0);
});

test("recordAnswer counts sure and guessed answers, and undo restores them", () => {
  const card = { id: "a", term: "A", definition: "1", status: "new" };
  recordAnswer(card, false, "2026-11-23", null, { confidence: "sure" });
  recordAnswer(card, true, "2026-11-23", null, { confidence: "guess" });
  const undo = recordAnswer(card, true, "2026-11-23", null, { confidence: "sure" });
  assert.deepEqual(card.stats, { seen: 3, missed: 1, sure: 2, sureMissed: 1, guess: 1, guessRight: 1 });
  undo();
  assert.deepEqual(card.stats, { seen: 2, missed: 1, sure: 1, sureMissed: 1, guess: 1, guessRight: 1 });
});

test("migrate keeps confidence counts consistent", () => {
  const out = migrate({ decks: [{ id: "d", cards: [{ id: "a", term: "A", definition: "1", stats: { seen: 4, missed: 1, sure: 9, sureMissed: 9, guess: 2, guessRight: 7 } }] }] });
  assert.deepEqual(out.decks[0].cards[0].stats, { seen: 4, missed: 1, sure: 4, sureMissed: 1 }); // no room left for guesses
});

test("sync carries mix-ups with the card's latest progress", () => {
  const deck = (mixups, last) => ({ id: "d", updatedAt: 1, cards: [{ id: "a", term: "A", definition: "1", status: "learning", srs: { box: 0, due: last, last }, ...(mixups ? { mixups } : {}) }] });
  const merged = mergeState({ decks: [deck({ b: 1 }, "2026-11-20")] }, { decks: [deck({ b: 3 }, "2026-11-22")] });
  assert.deepEqual(merged.decks[0].cards[0].mixups, { b: 3 });
  const cleared = mergeState({ decks: [deck(null, "2026-11-23")] }, { decks: [deck({ b: 3 }, "2026-11-22")] });
  assert.equal("mixups" in cleared.decks[0].cards[0], false);
});

test("synced data keeps mix-ups and confidence counts", () => {
  const remote = {
    decks: [{ id: "d", cards: [
      { id: "a", term: "A", definition: "1", status: "learning", stats: { seen: 2, missed: 1, sure: 1, sureMissed: 1 }, mixups: { b: 1 } },
      { id: "b", term: "B", definition: "2" },
    ] }],
  };
  const [a] = cleanSyncData(remote).decks[0].cards;
  assert.deepEqual(a.mixups, { b: 1 });
  assert.deepEqual(a.stats, { seen: 2, missed: 1, sure: 1, sureMissed: 1 });
});

test("calibration, overconfidence, and blind spots", () => {
  const decks = [
    { subject: "biology", cards: [
      { id: "a", term: "A", definition: "1", status: "learning", stats: { seen: 12, missed: 5, sure: 12, sureMissed: 5 } },
      { id: "b", term: "B", definition: "2", status: "known", stats: { seen: 4, missed: 1, sure: 2, sureMissed: 1, guess: 2, guessRight: 1 } },
    ] },
    { subject: "spanish", cards: [{ id: "c", term: "C", definition: "3", status: "new" }] },
  ];
  const [bio] = calibration(decks);
  assert.equal(calibration(decks).length, 1);
  assert.deepEqual({ sure: bio.sure, surePct: bio.surePct, guess: bio.guess, guessPct: bio.guessPct }, { sure: 14, surePct: 57, guess: 2, guessPct: 50 });
  assert.equal(isOverconfident(bio), true);
  assert.equal(isOverconfident({ sure: 5, surePct: 20 }), false); // too few answers to tell
  assert.deepEqual(blindSpots(decks).map((x) => x.card.id), ["a"]); // b is known now
});
