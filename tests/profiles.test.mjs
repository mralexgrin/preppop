import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRegistry, saveRegistry, addProfile, updateProfile, removeProfile, allDecks, profileKey, REGISTRY_KEY, FIRST_ID, MAX_PROFILES, AVATARS, displayName } from "../js/profiles.js";

const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => (data[k] = String(v)),
    removeItem: (k) => delete data[k],
  };
};

test("a brand-new device has no learners yet (onboarding)", () => {
  assert.equal(loadRegistry(memoryStorage()), null);
});

test("data saved before profiles becomes the first learner, on the same key", () => {
  const storage = memoryStorage({ "preppop:v1": JSON.stringify({ decks: [] }) });
  const reg = loadRegistry(storage);
  assert.equal(reg.active, FIRST_ID);
  assert.deepEqual(reg.list.map((p) => [p.id, p.name, p.level]), [[FIRST_ID, "", "high"]]);
  assert.equal(profileKey(FIRST_ID), "preppop:v1");
  assert.equal(displayName(reg.list[0]), "Learner");
});

test("adding learners: the first takes the original key, later ones get their own", () => {
  const first = addProfile(null, { name: "  Maya  ", avatar: AVATARS[3], level: "elementary" });
  assert.equal(first.profile.id, FIRST_ID);
  assert.equal(first.profile.name, "Maya");
  const second = addProfile(first.registry, { name: "Sam", avatar: "not an avatar", level: "graduate" });
  assert.notEqual(second.profile.id, FIRST_ID);
  assert.match(profileKey(second.profile.id), /^preppop:v1:p[A-Za-z0-9]+$/);
  assert.equal(second.profile.avatar, AVATARS[0], "unknown avatars fall back");
  assert.equal(second.profile.level, "high", "unknown levels fall back");
  assert.equal(second.registry.active, second.profile.id, "the new learner is active");
});

test("the registry is cleaned on load: bad ids, duplicates, long names, missing active", () => {
  const storage = memoryStorage({
    [REGISTRY_KEY]: JSON.stringify({
      active: "nope",
      list: [
        { id: "main", name: "x".repeat(80), avatar: "🦊", level: "middle" },
        { id: "main", name: "dup" },
        { id: "<script>", name: "bad" },
        { id: "p2", name: "Two", avatar: "🐼", level: "elementary" },
      ],
    }),
  });
  const reg = loadRegistry(storage);
  assert.deepEqual(reg.list.map((p) => p.id), ["main", "p2"]);
  assert.equal(reg.list[0].name.length, 30);
  assert.equal(reg.active, "main");
  assert.equal(loadRegistry(memoryStorage({ [REGISTRY_KEY]: "{broken" })), null);
});

test("there's a limit on learners per device", () => {
  let reg = null;
  for (let i = 0; i < MAX_PROFILES; i++) reg = addProfile(reg, { name: `L${i}`, level: "high" }).registry;
  assert.equal(addProfile(reg, { name: "one too many" }), null);
});

test("updating and removing learners; the last one can't be removed", () => {
  const storage = memoryStorage();
  let { registry } = addProfile(null, { name: "Maya", level: "elementary" });
  const sam = addProfile(registry, { name: "Sam", level: "middle" }).profile;
  storage.setItem(profileKey(sam.id), JSON.stringify({ decks: [{ id: "d", cards: [{ image: { id: "img1" } }] }] }));
  storage.setItem(profileKey(FIRST_ID), JSON.stringify({ decks: [{ id: "e", cards: [] }] }));
  assert.deepEqual(allDecks(registry, storage).map((d) => d.id), ["e", "d"], "every learner's decks, for picture cleanup");
  updateProfile(registry, sam.id, { name: "Samuel", level: "high", id: "hijack" });
  assert.equal(registry.list.find((p) => p.id === sam.id).name, "Samuel");
  assert.ok(removeProfile(registry, sam.id, storage));
  assert.equal(storage.getItem(profileKey(sam.id)), null, "their data is deleted");
  assert.equal(registry.active, FIRST_ID, "the other learner becomes active");
  assert.equal(removeProfile(registry, FIRST_ID, storage), false, "can't remove the last learner");
  saveRegistry(registry, storage);
  assert.equal(loadRegistry(storage).list.length, 1);
});
