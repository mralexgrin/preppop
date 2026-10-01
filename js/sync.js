// Sync across devices without an account. A random sync key is the only
// credential: from it the device derives (1) the id its data is stored under
// and (2) an AES-GCM key. Data is compressed and encrypted on the device, so
// the server only ever holds ciphertext under an opaque id. No email, name,
// or password is involved.

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32
const KEY_CHARS = 25; // 125 bits
const enc = new TextEncoder();
const dec = new TextDecoder();

export function newSyncKey(random = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const bytes = random(KEY_CHARS);
  const chars = [...bytes].map((b) => ALPHABET[b & 31]).join("");
  return chars.match(/.{5}/g).join("-");
}

// Accepts what a person types: lowercase, spaces, missing dashes, O for 0, I/L for 1.
export function normalizeSyncKey(input) {
  const raw = String(input ?? "")
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (raw.length !== KEY_CHARS || [...raw].some((c) => !ALPHABET.includes(c))) return null;
  return raw.match(/.{5}/g).join("-");
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hkdf(key, info, bits) {
  const base = await crypto.subtle.importKey("raw", enc.encode(key), "HKDF", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: enc.encode("preppop-sync-v1"), info: enc.encode(info) }, base, bits);
}

// From a sync key: the storage id (64 hex chars), a separate secret the
// server checks before any read or write (so knowing the id isn't enough),
// and the encryption key.
export async function deriveVault(syncKey) {
  const [idBits, authBits, keyBits] = await Promise.all([
    hkdf(syncKey, "vault-id", 256),
    hkdf(syncKey, "vault-auth", 256),
    hkdf(syncKey, "vault-key", 256),
  ]);
  const aesKey = await crypto.subtle.importKey("raw", keyBits, "AES-GCM", false, ["encrypt", "decrypt"]);
  return { id: hex(idBits), auth: hex(authBits), aesKey };
}

const toBase64 = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromBase64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function pipe(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

// JSON -> gzip -> AES-GCM -> base64 ("iv.ciphertext"). `label` (the vault id
// and version) is bound in as additional data, so a copy can't be replayed
// under another id or as another version.
export async function seal(aesKey, value, label = "") {
  const packed = await pipe(enc.encode(JSON.stringify(value)), new CompressionStream("gzip"));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(label) }, aesKey, packed));
  return `${toBase64(iv)}.${toBase64(sealed)}`;
}

export async function open(aesKey, text, label = "") {
  const [iv, body] = String(text).split(".");
  const packed = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv), additionalData: enc.encode(label) }, aesKey, fromBase64(body)),
  );
  return JSON.parse(dec.decode(await pipe(packed, new DecompressionStream("gzip"))));
}

// ---------- Merging two devices' data ----------

const lastPractice = (card) => card?.srs?.last ?? "";
const seenCount = (card) => card?.stats?.seen ?? 0;

// Whichever copy of a card was practiced most recently carries its progress.
function mergeCard(textFrom, a, b) {
  const progress = lastPractice(a) > lastPractice(b) || (lastPractice(a) === lastPractice(b) && seenCount(a) >= seenCount(b)) ? a : b;
  const out = { ...textFrom, status: progress.status };
  if (progress.srs) out.srs = progress.srs;
  else delete out.srs;
  if (progress.stats) out.stats = progress.stats;
  else delete out.stats;
  return out;
}

// Cards from both copies are kept (so cards added on either device survive),
// minus cards deleted on either device. Name, subject, and card text follow
// the most recently edited copy.
function mergeDeck(a, b) {
  const newer = (a.updatedAt ?? 0) >= (b.updatedAt ?? 0) ? a : b;
  const older = newer === a ? b : a;
  const deletedCards = { ...(older.deletedCards ?? {}), ...(newer.deletedCards ?? {}) };
  const olderCards = new Map(older.cards.map((c) => [c.id, c]));
  const newerIds = new Set(newer.cards.map((c) => c.id));
  const cards = [
    ...newer.cards.map((card) => (olderCards.has(card.id) ? mergeCard(card, card, olderCards.get(card.id)) : card)),
    ...older.cards.filter((card) => !newerIds.has(card.id)),
  ].filter((card) => !deletedCards[card.id]);
  return { ...newer, cards, deletedCards };
}

export function mergeState(local, remote) {
  const deleted = { ...(remote.deletedDecks ?? {}) };
  for (const [id, at] of Object.entries(local.deletedDecks ?? {})) deleted[id] = Math.max(at, deleted[id] ?? 0);

  const byId = new Map();
  for (const deck of remote.decks ?? []) byId.set(deck.id, deck);
  for (const deck of local.decks ?? []) byId.set(deck.id, byId.has(deck.id) ? mergeDeck(deck, byId.get(deck.id)) : deck);
  // Local order first, then decks that only exist on the other device.
  const order = [...(local.decks ?? []).map((d) => d.id), ...(remote.decks ?? []).map((d) => d.id)];
  const decks = [...new Set(order)]
    .map((id) => byId.get(id))
    .filter((deck) => !(deleted[deck.id] && deleted[deck.id] >= (deck.updatedAt ?? 0)));

  const activity = { ...(remote.activity ?? {}) };
  for (const [day, v] of Object.entries(local.activity ?? {})) {
    const other = activity[day];
    activity[day] = !other || v.answered >= other.answered ? v : other;
  }
  return { decks, activity, deletedDecks: deleted };
}

// What gets uploaded: decks, progress, and deletions. Device settings and
// cached AI answers stay on each device.
export const syncPayload = (state) => ({ decks: state.decks, activity: state.activity, deletedDecks: state.deletedDecks ?? {} });
