import { test } from "node:test";
import assert from "node:assert/strict";
import { migrate, load, persist, state, STORE_KEY } from "../js/store.js";

const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => (data[k] = String(v)), data };
};

test("migrate fills defaults for empty or junk input", () => {
  assert.deepEqual(migrate(null), { decks: [], distractors: {} });
  assert.deepEqual(migrate("nope"), { decks: [], distractors: {} });
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
