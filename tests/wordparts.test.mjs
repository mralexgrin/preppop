import { test } from "node:test";
import assert from "node:assert/strict";
import { WORDS, STARTER_ID, partCards, meaningOf, decodeQuestion, buildQuestion, checkBuild, makeRound } from "../js/wordparts.js";
import { STARTERS } from "../js/starters.js";

const starter = STARTERS.find((s) => s.id === STARTER_ID);
const deck = { id: "d", starter: STARTER_ID, cards: starter.cards.map((c, i) => ({ id: `c${i}`, ...c })) };
const word = (w) => WORDS.find((x) => x.word === w);

test("every word part is a card in the Medical terminology starter deck", () => {
  const terms = new Set(starter.cards.map((c) => c.term));
  for (const w of WORDS) for (const p of w.parts) assert.ok(terms.has(p), `${w.word}: "${p}" isn't in the starter deck`);
});

test("words are unique and complete", () => {
  assert.equal(new Set(WORDS.map((w) => w.word)).size, WORDS.length);
  assert.equal(new Set(WORDS.map((w) => w.meaning)).size, WORDS.length, "meanings must differ, or decode has two right answers");
  for (const w of WORDS) assert.ok(w.word && w.meaning && w.es && w.parts.length >= 2, w.word);
});

test("partCards finds the deck's cards for a word, skipping ones she deleted", () => {
  assert.deepEqual(partCards(deck, word("tachycardia")).map((c) => c.term), ["tachy-", "cardi/o"]);
  const trimmed = { ...deck, cards: deck.cards.filter((c) => c.term !== "tachy-") };
  assert.deepEqual(partCards(trimmed, word("tachycardia")).map((c) => c.term), ["cardi/o"]);
  assert.deepEqual(partCards(null, word("tachycardia")), []);
  assert.equal(meaningOf(deck, "brady-"), "slow");
});

test("decode offers the real meaning plus look-alikes that share a part", () => {
  const q = decodeQuestion(word("tachycardia"));
  assert.equal(q.options.length, 4);
  assert.ok(q.options.includes("fast heart rate"));
  assert.equal(new Set(q.options).size, 4);
  const sharing = WORDS.filter((w) => w.word !== "tachycardia" && w.parts.some((p) => ["tachy-", "cardi/o"].includes(p))).map((w) => w.meaning);
  assert.ok(q.options.filter((o) => o !== "fast heart rate").every((o) => sharing.includes(o)), "all wrong choices share a part");
});

test("build gives a tray with the parts plus look-alike distractors", () => {
  const w = word("pericarditis");
  const q = buildQuestion(w);
  assert.equal(q.tray.length, 6);
  for (const p of w.parts) assert.ok(q.tray.includes(p));
  assert.equal(new Set(q.tray).size, 6);
  assert.equal(checkBuild(["peri-", "cardi/o", "-itis"], w), true);
  assert.equal(checkBuild(["endo-", "cardi/o", "-itis"], w), false);
  assert.equal(checkBuild(["cardi/o", "peri-", "-itis"], w), false, "order matters");
  assert.equal(checkBuild(["peri-", "cardi/o"], w), false);
});

test("a round mixes decode and build, least-practiced words first", () => {
  const round = makeRound(WORDS, 10, (w) => (w.word === "apnea" ? 0 : 5));
  assert.equal(round.length, 10);
  assert.equal(round[0].word.word, "apnea");
  assert.deepEqual(new Set(round.map((q) => q.kind)), new Set(["decode", "build"]));
  assert.equal(new Set(round.map((q) => q.word.word)).size, 10);
});

test("the starter marker (which shows the Words tab) survives backups and sync", async () => {
  const { cleanSyncData, makeBackup, readFile } = await import("../js/backup.js");
  const { migrate } = await import("../js/store.js");
  const { hasWordBuilder } = await import("../js/wordparts.js");
  const decks = [{ id: "d1", name: "Med", subject: "clinical", starter: "med-terms", cards: [{ id: "c1", term: "tachy-", definition: "fast" }] }];
  assert.ok(hasWordBuilder(cleanSyncData({ decks }).decks[0]));
  assert.ok(hasWordBuilder(readFile(JSON.stringify(makeBackup({ decks, activity: {}, settings: {} }))).decks[0]));
  assert.equal("starter" in migrate({ decks: [{ ...decks[0], starter: "<x>" }] }).decks[0], false);
  assert.equal(hasWordBuilder({ starter: "vital-signs" }), false);
});

test("partGrades: decode credits shared parts, build ignores order, unrelated picks leave cards alone", async () => {
  const { partGrades } = await import("../js/wordparts.js");
  assert.deepEqual(partGrades(word("tachycardia"), "decode", "fast heart rate"), [true, true]);
  assert.deepEqual(partGrades(word("tachycardia"), "decode", "fast breathing"), [true, false]); // tachypnea: tachy- right, cardi/o missed
  assert.deepEqual(partGrades(word("tachycardia"), "decode", "study of bones"), [null, null]); // shares nothing
  assert.deepEqual(partGrades(word("pericarditis"), "build", ["cardi/o", "peri-", "-itis"]), [true, true, true]); // wrong order, right parts
  assert.deepEqual(partGrades(word("pericarditis"), "build", ["endo-", "cardi/o", "-itis"]), [false, true, true]);
});

test("usable words skip ones whose part cards she deleted; meanings fall back to the starter", async () => {
  const { usableWords } = await import("../js/wordparts.js");
  const trimmed = { ...deck, cards: deck.cards.filter((c) => c.term !== "tachy-") };
  const usable = usableWords(trimmed);
  assert.ok(!usable.some((w) => w.parts.includes("tachy-")));
  assert.ok(usable.some((w) => w.word === "bradycardia"));
  assert.equal(meaningOf(trimmed, "tachy-"), "fast");
  const round = makeRound(usable, 10);
  assert.ok(round.every((q) => !q.word.parts.includes("tachy-")));
});

test("a word is never offered a wrong choice that is also true for it", () => {
  for (let i = 0; i < 30; i++) {
    assert.ok(!decodeQuestion(word("gastroscopy")).options.includes(word("endoscopy").meaning));
    assert.ok(!decodeQuestion(word("endoscopy")).options.includes(word("gastroscopy").meaning));
  }
});

test("sync keeps the starter marker even if the newer copy lost it", async () => {
  const { mergeState } = await import("../js/sync.js");
  const copy = (starter, updatedAt) => ({ id: "d", name: "Med", updatedAt, ...(starter ? { starter } : {}), cards: [] });
  assert.equal(mergeState({ decks: [copy(null, 5)] }, { decks: [copy("med-terms", 1)] }).decks[0].starter, "med-terms");
  assert.equal(mergeState({ decks: [copy("med-terms", 1)] }, { decks: [copy(null, 5)] }).decks[0].starter, "med-terms");
});

test("recordAnswer can skip today's count; countPractice adds one", async () => {
  const { recordAnswer, countPractice, state } = await import("../js/store.js");
  state.activity = {};
  const card = { id: "a", term: "A", definition: "1", status: "new" };
  const undo = recordAnswer(card, true, "2026-11-23", null, { count: false });
  assert.deepEqual(state.activity, {});
  assert.equal(card.stats.seen, 1);
  countPractice(true, "2026-11-23");
  assert.deepEqual(state.activity["2026-11-23"], { answered: 1, correct: 1 });
  undo();
  assert.deepEqual(state.activity["2026-11-23"], { answered: 1, correct: 1 }); // undo leaves the separate count alone
});
