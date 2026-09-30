import { test } from "node:test";
import assert from "node:assert/strict";
import { migrate, load, persist, state, STORE_KEY, recordAnswer } from "../js/store.js";

const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => (data[k] = String(v)), data };
};

test("migrate fills defaults for empty or junk input", () => {
  assert.deepEqual(migrate(null), { decks: [], distractors: {}, settings: {}, activity: {} });
  assert.deepEqual(migrate("nope"), { decks: [], distractors: {}, settings: {}, activity: {} });
});

test("migrate drops an old stored API key and keeps decks", () => {
  const out = migrate({ apiKey: "sk-old", decks: [{ id: "d1", name: "Bio", cards: [] }] });
  assert.equal("apiKey" in out, false);
  assert.equal(out.decks[0].name, "Bio");
});

test("load rewrites storage without the old key", () => {
  const storage = memoryStorage({ [STORE_KEY]: JSON.stringify({ apiKey: "sk-old", decks: [], distractors: {} }) });
  load(storage);
  assert.equal(JSON.parse(storage.data[STORE_KEY]).apiKey, undefined);
});

test("load survives unreadable storage", () => {
  const storage = memoryStorage({ [STORE_KEY]: "{not json" });
  assert.doesNotThrow(() => load(storage));
});

test("persist reports failure instead of throwing", () => {
  const full = { getItem: () => null, setItem: () => { throw new Error("QuotaExceeded"); } };
  assert.equal(persist(full), false);
  assert.equal(persist(memoryStorage()), true);
  assert.ok(Array.isArray(state.decks));
});

test("migrate gives old decks a subject and keeps valid ones", () => {
  const out = migrate({ decks: [{ id: "a", name: "Old", cards: [] }, { id: "b", name: "Bio", subject: "biology", cards: [] }, { id: "c", name: "Bad", subject: "astrology" }] });
  assert.deepEqual(out.decks.map((d) => d.subject), ["other", "biology", "other"]);
  assert.deepEqual(out.decks[2].cards, []);
});

test("migrate seeds a schedule for cards saved before spaced repetition", () => {
  const out = migrate({ decks: [{ id: "d", cards: [{ id: "1", status: "known" }, { id: "2", status: "learning" }, { id: "3", status: "new" }] }] }, "2026-09-30");
  const [known, learning, fresh] = out.decks[0].cards;
  assert.deepEqual(known.srs, { box: 1, due: "2026-10-01" });
  assert.deepEqual(learning.srs, { box: 0, due: "2026-09-30" });
  assert.equal(fresh.srs, undefined);
});

test("recordAnswer schedules the card and counts today's practice", () => {
  state.activity = {};
  const card = { id: "x", term: "a", definition: "b", status: "new" };
  recordAnswer(card, true, "2026-09-30");
  recordAnswer({ id: "y" }, false, "2026-09-30");
  assert.equal(card.status, "known");
  assert.equal(card.srs.due, "2026-10-01");
  assert.deepEqual(state.activity["2026-09-30"], { answered: 2, correct: 1 });
});

test("migrate repairs non-object activity, settings, and distractors", () => {
  const out = migrate({ activity: null, settings: [], distractors: "x" });
  assert.deepEqual([out.activity, out.settings, out.distractors], [{}, {}, {}]);
});

test("migrate cleans unsafe ids, bad fields, and bad settings already in storage", () => {
  const out = migrate({
    decks: [{ id: "<x>", name: 5, cards: [{ id: "<y>", term: 1, definition: null, status: "hacked" }] }, "junk"],
    settings: { lastSubject: "<script>", dailyGoal: -3 },
  });
  assert.equal(out.decks.length, 1);
  assert.match(out.decks[0].id, /^[A-Za-z0-9_-]+$/);
  assert.equal(out.decks[0].name, "Untitled deck");
  const [card] = out.decks[0].cards;
  assert.match(card.id, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual([card.term, card.definition, card.status], ["", "", "new"]);
  assert.deepEqual(out.settings, {});
});
