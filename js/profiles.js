// Learner profiles on this device: no email or password, just a name (a
// first name or nickname), an avatar, and a school level. Each profile's
// decks, progress, settings, and sync key are saved under its own storage
// key; the list of profiles lives in a small registry. The first profile
// uses the original key, so data saved before profiles existed becomes it.
// Switching profiles reloads the app with the other profile's data.

import { uid } from "./util.js";
import { isLevel } from "./starters.js";

export const REGISTRY_KEY = "preppop:profiles";
export const FIRST_ID = "main";
const LEGACY_KEY = "preppop:v1";
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
export const MAX_NAME = 30;
export const MAX_PROFILES = 8;

export const AVATARS = ["🦊", "🐼", "🐸", "🦉", "🐙", "🦁", "🐢", "🐝", "🦄", "🐳", "🐧", "🦖"];
export const AVATAR_NAMES = ["Fox", "Panda", "Frog", "Owl", "Octopus", "Lion", "Turtle", "Bee", "Unicorn", "Whale", "Penguin", "Dinosaur"];

export const profileKey = (id) => (id === FIRST_ID ? LEGACY_KEY : `${LEGACY_KEY}:${id}`);

// No control or invisible formatting characters; cut by character, not code unit, so emoji stay whole.
const cleanName = (name) =>
  typeof name === "string" ? Array.from(name.replace(/[\p{Cc}\p{Cf}]/gu, "").replace(/\s+/g, " ").trim()).slice(0, MAX_NAME).join("").trim() : "";

function cleanProfile(p) {
  if (!p || typeof p !== "object" || !SAFE_ID.test(p.id)) return null;
  return {
    id: p.id,
    name: cleanName(p.name),
    avatar: AVATARS.includes(p.avatar) ? p.avatar : AVATARS[0],
    level: isLevel(p.level) ? p.level : "high",
    createdAt: Number.isFinite(p.createdAt) ? p.createdAt : 0,
  };
}

function read(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

// The registry, cleaned. Data saved before profiles existed becomes an
// unnamed high school profile. Returns null when there's nothing yet (first run).
export function loadRegistry(storage = globalThis.localStorage) {
  let saved = null;
  try {
    saved = JSON.parse(read(storage, REGISTRY_KEY) ?? "null");
  } catch {
    saved = null;
  }
  const seen = new Set();
  const list = (Array.isArray(saved?.list) ? saved.list : [])
    .map(cleanProfile)
    .filter((p) => p && !seen.has(p.id) && seen.add(p.id))
    .slice(0, MAX_PROFILES);
  // Learner data the list doesn't know about (data from before profiles, a
  // damaged list, or another tab's change) is kept as an unnamed learner,
  // never thrown away.
  for (const id of savedIds(storage)) {
    if (!seen.has(id) && list.length < MAX_PROFILES) {
      seen.add(id);
      list.push({ id, name: "", avatar: AVATARS[0], level: "high", createdAt: 0 });
    }
  }
  if (!list.length) return null;
  const active = list.some((p) => p.id === saved?.active) ? saved.active : list[0].id;
  return { active, list };
}

// Ids of learners with saved data on this device.
function savedIds(storage) {
  const ids = [];
  if (read(storage, LEGACY_KEY) !== null) ids.push(FIRST_ID);
  try {
    for (let i = 0; i < (storage.length ?? 0); i++) {
      const m = /^preppop:v1:([A-Za-z0-9_-]{1,64})$/.exec(storage.key(i) ?? "");
      if (m && m[1] !== FIRST_ID) ids.push(m[1]);
    }
  } catch {
    // Storage blocked.
  }
  return ids;
}

export function saveRegistry(registry, storage = globalThis.localStorage) {
  try {
    storage.setItem(REGISTRY_KEY, JSON.stringify(registry));
    return true;
  } catch {
    return false;
  }
}

export const activeProfile = (registry) => registry?.list.find((p) => p.id === registry.active) ?? null;

// Adds a profile and makes it active. The first one on a device takes the
// original storage key. Returns the new profile, or null if there are too many.
// hasData(id): true if a learner's data is already saved under that id, so a
// new learner never takes over existing data.
export function addProfile(registry, { name, avatar, level }, now = Date.now(), hasData = () => false) {
  const reg = registry ?? { active: null, list: [] };
  if (reg.list.length >= MAX_PROFILES) return null;
  const taken = new Set([...reg.list.map((p) => p.id), ...[FIRST_ID].filter(hasData)]);
  let id = taken.has(FIRST_ID) ? `p${uid().replace(/[^A-Za-z0-9]/g, "").slice(0, 12)}` : FIRST_ID;
  while (taken.has(id) || hasData(id)) id = `p${uid().replace(/[^A-Za-z0-9]/g, "").slice(0, 12)}`;
  const profile = cleanProfile({ id, name, avatar, level, createdAt: now });
  reg.list.push(profile);
  reg.active = id;
  return { registry: reg, profile };
}

export function updateProfile(registry, id, changes) {
  const p = registry.list.find((x) => x.id === id);
  if (!p) return null;
  Object.assign(p, cleanProfile({ ...p, ...changes, avatar: changes.avatar ?? p.avatar, id }));
  return p;
}

// Removes a profile and its saved data. The last profile can't be removed.
export function removeProfile(registry, id, storage = globalThis.localStorage) {
  if (registry.list.length <= 1 || !registry.list.some((p) => p.id === id)) return false;
  registry.list = registry.list.filter((p) => p.id !== id);
  if (registry.active === id) registry.active = registry.list[0].id;
  try {
    storage.removeItem(profileKey(id));
  } catch {
    // Storage blocked: the registry no longer points at it either way.
  }
  return true;
}

// Every learner's decks, for cleaning up pictures no learner uses anymore.
// Returns null if any learner's data can't be read, so cleanup is skipped
// rather than deleting pictures that learner might use.
export function allDecks(registry, storage = globalThis.localStorage) {
  const out = [];
  for (const p of registry?.list ?? []) {
    try {
      const decks = JSON.parse(read(storage, profileKey(p.id)) ?? "{}").decks;
      if (Array.isArray(decks)) out.push(...decks.filter((d) => d && Array.isArray(d.cards)));
    } catch {
      return null;
    }
  }
  return out;
}

export const displayName = (p) => p?.name || "Learner";

// This page load's registry (set at startup by js/app.js).
export const session = { registry: null };
// Before changing the list, start from what's saved (another tab may have changed it).
export function refreshRegistry(storage = globalThis.localStorage) {
  const saved = loadRegistry(storage);
  if (saved && session.registry) saved.active = session.registry.active;
  if (saved) session.registry = saved;
  return session.registry;
}
export const currentProfile = () => activeProfile(session.registry);
export const currentLevel = () => currentProfile()?.level ?? "high";

// Switch learner: save the choice and reload with that profile's data.
export function switchTo(id, storage = globalThis.localStorage) {
  if (!session.registry?.list.some((p) => p.id === id)) return;
  session.registry.active = id;
  if (!saveRegistry(session.registry, storage)) return false;
  location.hash = "#/";
  location.reload();
  return true;
}
