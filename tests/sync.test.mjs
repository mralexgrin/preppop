import { test } from "node:test";
import assert from "node:assert/strict";
import { newSyncKey, normalizeSyncKey, deriveVault, seal, open, mergeState, syncPayload } from "../js/sync.js";

test("sync keys look like XXXXX-XXXXX-XXXXX-XXXXX-XXXXX and are random", () => {
  const a = newSyncKey();
  assert.match(a, /^[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){4}$/);
  assert.notEqual(a, newSyncKey());
});

test("typed keys are forgiving", () => {
  const key = "K7Q2M-9XJ4T-0000A-11111-ZZZZZ";
  assert.equal(normalizeSyncKey("k7q2m 9xj4t oooOa iiLli zzzzz"), key);
  assert.equal(normalizeSyncKey("K7Q2M9XJ4T0000A11111ZZZZZ"), key);
  assert.equal(normalizeSyncKey("too short"), null);
  assert.equal(normalizeSyncKey("K7Q2M-9XJ4T-0000A-11111-ZZZZU"), null); // U isn't in the alphabet
});

test("the same key always gives the same storage id; different keys differ", async () => {
  const key = newSyncKey();
  const a = await deriveVault(key);
  const b = await deriveVault(key);
  const c = await deriveVault(newSyncKey());
  assert.match(a.id, /^[0-9a-f]{64}$/);
  assert.equal(a.id, b.id);
  assert.notEqual(a.id, c.id);
  assert.ok(!a.id.includes(key.replace(/-/g, "").toLowerCase()), "id doesn't reveal the key");
});

test("seal/open round-trips and ciphertext hides the content", async () => {
  const { aesKey } = await deriveVault(newSyncKey());
  const data = { decks: [{ id: "d", name: "Vital signs", cards: [{ id: "c", term: "Pulse", definition: "60-100 bpm" }] }] };
  const sealed = await seal(aesKey, data);
  assert.ok(!sealed.includes("Vital"), "plaintext not visible");
  assert.deepEqual(await open(aesKey, sealed), data);
  const other = (await deriveVault(newSyncKey())).aesKey;
  await assert.rejects(() => open(other, sealed), "wrong key can't decrypt");
});

const card = (id, extra = {}) => ({ id, term: `t${id}`, definition: `d${id}`, status: "new", ...extra });

test("merge: decks from both devices are kept", () => {
  const out = mergeState({ decks: [{ id: "a", cards: [] }] }, { decks: [{ id: "b", cards: [] }] });
  assert.deepEqual(out.decks.map((d) => d.id), ["a", "b"]);
});

test("merge: cards from both copies are kept; text follows the most recently edited deck; progress follows the most recent practice", () => {
  const phone = {
    decks: [{ id: "d", name: "Old name", updatedAt: 100, cards: [card("1", { status: "known", srs: { box: 3, due: "2026-10-05", last: "2026-09-30" } }), card("2")] }],
  };
  const laptop = {
    decks: [{ id: "d", name: "New name", updatedAt: 200, cards: [card("1", { term: "edited", status: "learning", srs: { box: 0, due: "2026-09-20", last: "2026-09-20" } }), card("3")] }],
  };
  const [deck] = mergeState(phone, laptop).decks;
  assert.equal(deck.name, "New name");
  assert.deepEqual(deck.cards.map((c) => c.id), ["1", "3", "2"]);
  assert.equal(deck.cards[0].term, "edited");
  assert.equal(deck.cards[0].status, "known");
  assert.equal(deck.cards[0].srs.box, 3);
});

test("merge: a deck deleted on one device stays deleted unless edited later", () => {
  const local = { decks: [{ id: "keep", updatedAt: 500, cards: [] }], deletedDecks: { gone: 300 } };
  const remote = { decks: [{ id: "gone", updatedAt: 200, cards: [] }, { id: "keep", updatedAt: 100, cards: [] }], deletedDecks: { keep: 400 } };
  const out = mergeState(local, remote);
  assert.deepEqual(out.decks.map((d) => d.id), ["keep"]);
  assert.deepEqual(out.deletedDecks, { gone: 300, keep: 400 });
});

test("merge: practice history keeps the busier count per day", () => {
  const out = mergeState({ decks: [], activity: { a: { answered: 5, correct: 5 } } }, { decks: [], activity: { a: { answered: 9, correct: 7 }, b: { answered: 1, correct: 1 } } });
  assert.deepEqual(out.activity, { a: { answered: 9, correct: 7 }, b: { answered: 1, correct: 1 } });
});

test("the upload leaves out device settings and cached AI answers", () => {
  const payload = syncPayload({ decks: [], activity: {}, settings: { dailyGoal: 30 }, distractors: { x: [] }, sync: { key: "secret" } });
  assert.deepEqual(Object.keys(payload).sort(), ["activity", "decks", "deletedDecks"]);
});

test("merge: a card deleted on one device stays deleted", () => {
  const phone = { decks: [{ id: "d", updatedAt: 300, cards: [card("1")], deletedCards: { 2: 250 } }] };
  const laptop = { decks: [{ id: "d", updatedAt: 100, cards: [card("1"), card("2")] }] };
  const [deck] = mergeState(phone, laptop).decks;
  assert.deepEqual(deck.cards.map((c) => c.id), ["1"]);
  assert.deepEqual(deck.deletedCards, { 2: 250 });
});

test("sealed data only opens with the same label (vault id and version)", async () => {
  const { aesKey } = await deriveVault(newSyncKey());
  const sealed = await seal(aesKey, { a: 1 }, "vault:3");
  assert.deepEqual(await open(aesKey, sealed, "vault:3"), { a: 1 });
  await assert.rejects(() => open(aesKey, sealed, "vault:2"), "can't be replayed as another version");
});

test("the server auth secret is separate from the id and the key", async () => {
  const v = await deriveVault(newSyncKey());
  assert.match(v.auth, /^[0-9a-f]{64}$/);
  assert.notEqual(v.auth, v.id);
});
