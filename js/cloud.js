// Sync engine: talks to the Worker's /vault/:id and keeps this device and
// the encrypted cloud copy in step. See js/sync.js for keys, encryption, and
// the merge rules.
//
// syncNow() pulls, merges, and pushes. It can replace deck objects, so it
// only runs where no screen holds on to a deck (the deck list, Progress,
// Settings). pushChanges() only uploads and is safe any time; if another
// device changed something first, it flags a merge for the next syncNow().
//
// Everything downloaded is treated like an imported file and cleaned
// (cleanSyncData) before it's merged: anyone with the sync key could have
// written it.

import { state, persist } from "./store.js";
import { deriveVault, seal, open, mergeState, syncPayload, newSyncKey, normalizeSyncKey } from "./sync.js";
import { cleanSyncData } from "./backup.js";
import { SERVICE_URL } from "./ai.js";

export const syncStatus = { busy: false, error: null, needsMerge: false };

const ERRORS = {
  rate_limited: "too many syncs in a short time, try again in a minute",
  sync_unavailable: "sync isn't set up on the PrepPop service yet",
  bad_request: "the sync data was rejected",
  unauthorized: "this sync key was rejected",
  too_many_new: "too many new sync keys from this network today",
};

let vault = null;
async function currentVault() {
  if (!vault || vault.key !== state.sync.key) vault = { key: state.sync.key, ...(await deriveVault(state.sync.key)) };
  return vault;
}

async function api(method, v, body) {
  if (globalThis.navigator?.onLine === false) throw new Error("you're offline");
  let res;
  try {
    res = await fetch(`${SERVICE_URL}/vault/${v.id}`, {
      method,
      headers: { "x-vault-auth": v.auth, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("couldn't reach the sync service");
  }
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const failure = (res) => new Error(ERRORS[res.data?.error] ?? "the sync service had a problem");
const label = (v, version) => `${v.id}:${version}`;

// The cloud copy was erased (from another device): stop syncing here too.
class Erased extends Error {}
function stopBecauseErased() {
  state.sync = null;
  vault = null;
  syncStatus.needsMerge = false;
  syncStatus.error = "sync was turned off and the cloud copy erased from another device. Your decks are still here";
  persist(undefined, { quiet: true });
}

async function applyRemote(v, sealed, version) {
  const remote = cleanSyncData(await open(v.aesKey, sealed, label(v, version)));
  const merged = mergeState(syncPayload(state), remote);
  state.decks = merged.decks;
  state.activity = merged.activity;
  state.deletedDecks = merged.deletedDecks;
}

function saved(version) {
  state.sync.version = version;
  state.sync.lastSync = Date.now();
  syncStatus.needsMerge = false;
  syncStatus.error = null;
  persist(undefined, { quiet: true });
}

async function put(v, base) {
  return api("PUT", v, { base, data: await seal(v.aesKey, syncPayload(state), label(v, base + 1)) });
}

// Returns true if this device's data changed (so the screen should redraw).
// mustExist: fail instead of creating a new cloud copy (used when linking a
// device with a typed key, so a typo doesn't start an empty vault).
export async function syncNow({ mustExist = false } = {}) {
  if (!state.sync || syncStatus.busy) return false;
  syncStatus.busy = true;
  const before = JSON.stringify(syncPayload(state));
  try {
    const v = await currentVault();
    const got = await api("GET", v);
    if (got.status === 410) throw new Erased();
    let base = 0;
    if (got.status === 200) {
      await applyRemote(v, got.data.data, got.data.version);
      base = got.data.version;
    } else if (got.status === 404) {
      if (mustExist) throw new Error("no synced decks were found for that key. Check it and try again");
    } else {
      throw failure(got);
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await put(v, base);
      if (res.status === 200) {
        saved(res.data.version);
        return JSON.stringify(syncPayload(state)) !== before;
      }
      if (res.status === 410) throw new Erased();
      if (res.status !== 409) throw failure(res);
      await applyRemote(v, res.data.data, res.data.version);
      base = res.data.version;
    }
    throw new Error("another device kept syncing at the same time, try again");
  } catch (err) {
    if (err instanceof Erased) stopBecauseErased();
    else {
      syncStatus.error = err.message || "the sync data couldn't be read";
      persist(undefined, { quiet: true });
    }
    return JSON.stringify(syncPayload(state)) !== before;
  } finally {
    syncStatus.busy = false;
  }
}

export async function pushChanges() {
  if (!state.sync || syncStatus.busy) return;
  syncStatus.busy = true;
  try {
    const v = await currentVault();
    const res = await put(v, state.sync.version);
    if (res.status === 200) saved(res.data.version);
    else if (res.status === 410) stopBecauseErased();
    else if (res.status === 409 || res.status === 404) syncStatus.needsMerge = true;
    else syncStatus.error = failure(res).message;
  } catch (err) {
    syncStatus.error = err.message;
  } finally {
    syncStatus.busy = false;
  }
}

// Turn sync on with a brand-new key.
export async function enableSync() {
  state.sync = { key: newSyncKey(), version: 0, lastSync: null };
  syncStatus.error = null;
  persist(undefined, { quiet: true });
  await syncNow();
  return state.sync?.key;
}

// Link this device to an existing key. Resolves to an error message or null.
export async function connectSync(input) {
  const key = normalizeSyncKey(input);
  if (!key) return "That doesn't look like a sync key. It has 25 letters and numbers, like ABCDE-12345-…";
  // If connecting fails partway, put everything back the way it was.
  const snapshot = { sync: state.sync, decks: state.decks, activity: state.activity, deletedDecks: state.deletedDecks };
  state.sync = { key, version: 0, lastSync: null };
  syncStatus.error = null;
  await syncNow({ mustExist: true });
  if (!state.sync || syncStatus.error) {
    const message = syncStatus.error ?? "the sync key was rejected";
    Object.assign(state, snapshot);
    vault = null;
    syncStatus.error = null;
    persist(undefined, { quiet: true });
    return `Couldn't connect: ${message}.`;
  }
  return null;
}

// Stop syncing on this device. Optionally erase the cloud copy too, which
// also turns sync off on every other device the next time it syncs.
export async function disableSync({ eraseCloud = false } = {}) {
  if (!state.sync) return null;
  if (eraseCloud) {
    try {
      const v = await currentVault();
      const res = await api("DELETE", v);
      if (res.status !== 200) return `Couldn't erase the cloud copy: ${failure(res).message}.`;
    } catch (err) {
      return `Couldn't erase the cloud copy: ${err.message}.`;
    }
  }
  state.sync = null;
  vault = null;
  syncStatus.error = null;
  syncStatus.needsMerge = false;
  persist(undefined, { quiet: true });
  return null;
}
