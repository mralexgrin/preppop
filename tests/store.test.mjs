import { test } from "node:test";
import assert from "node:assert/strict";
import { migrate, load, persist, state, STORE_KEY, recordAnswer } from "../js/store.js";

const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => (data[k] = String(v)), data };
};

test("migrate fills defaults for empty or junk input", () => {
  assert.deepEqual(migrate(null), { decks: [], distractors: {}, settings: {}, activity: {}, deletedDecks: {}, sync: null });
  assert.deepEqual(migrate("nope"), { decks: [], distractors: {}, settings: {}, activity: {}, deletedDecks: {}, sync: null });
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

test("recordAnswer counts how often a card was seen and missed", () => {
  const card = { id: "s", status: "new" };
  recordAnswer(card, false, "2026-09-30");
  recordAnswer(card, true, "2026-09-30");
  assert.deepEqual(card.stats, { seen: 2, missed: 1 });
});

test("migrate keeps valid stats and repairs bad ones", () => {
  const out = migrate({ decks: [{ id: "d", cards: [
    { id: "a", stats: { seen: 4, missed: 2 } },
    { id: "b", stats: { seen: -1, missed: 9 } },
    { id: "c" },
  ] }] });
  const [a, b, c] = out.decks[0].cards;
  assert.deepEqual(a.stats, { seen: 4, missed: 2 });
  assert.deepEqual(b.stats, { seen: 0, missed: 0 });
  assert.equal(c.stats, undefined);
});

test("migrate keeps a valid sync setup and drops a broken one", () => {
  const good = migrate({ sync: { key: "k7q2m 9xj4t 0000a 11111 zzzzz", version: 3, lastSync: 5 } });
  assert.deepEqual(good.sync, { key: "K7Q2M-9XJ4T-0000A-11111-ZZZZZ", version: 3, lastSync: 5 });
  assert.equal(migrate({ sync: { key: "nope" } }).sync, null);
  assert.deepEqual(migrate({ deletedDecks: { ok: 5, "<bad>": 6, also: "x" } }).deletedDecks, { ok: 5 });
});

test("decks get an updatedAt, defaulting to createdAt", () => {
  const out = migrate({ decks: [{ id: "a", createdAt: 42, cards: [] }, { id: "b", updatedAt: 99, cards: [] }] });
  assert.deepEqual(out.decks.map((d) => d.updatedAt), [42, 99]);
});

test("migrate keeps a valid test date and drops a bad one", () => {
  const out = migrate({ decks: [{ id: "a", examDate: "2026-10-04", cards: [] }, { id: "b", examDate: "<x>", cards: [] }] });
  assert.equal(out.decks[0].examDate, "2026-10-04");
  assert.equal("examDate" in out.decks[1], false);
});

test("recordAnswer uses the deck's test date", () => {
  const card = { id: "e", srs: { box: 2, due: "2026-09-30" } };
  recordAnswer(card, true, "2026-09-30", { examDate: "2026-10-04" });
  assert.equal(card.srs.due, "2026-10-03");
});

test("migrate keeps short text hints and drops bad ones", () => {
  const out = migrate({ decks: [{ id: "h", cards: [{ id: "1", hint: "brady = slow" }, { id: "2", hint: 42 }, { id: "3", hint: "   " }, { id: "4", hint: "x".repeat(500) }] }] });
  const hints = out.decks[0].cards.map((c) => c.hint);
  assert.deepEqual(hints.slice(0, 3), ["brady = slow", undefined, undefined]);
  assert.equal(hints[3].length, 300);
  assert.equal("hint" in out.decks[0].cards[1], false);
});
