// Pictures on cards. localStorage is too small for images, so they live in
// IndexedDB, shrunk on the device first (longest side 1024px, WebP or JPEG).
// Cards only hold a reference: card.image = { id, side: "term" | "definition" }.

import { uid } from "./util.js";

const DB_NAME = "preppop-images";
const STORE = "images";
const MAX_SIDE = 1024;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // per image, after shrinking
export const DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

let dbPromise;
function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(mode, run) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const result = run(t.objectStore(STORE));
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error("storage full"));
  });
}

// Stored as { blob, at }; older entries may be a bare Blob.
export const getImage = async (id) => {
  const value = await tx("readonly", (s) => s.get(id));
  return value?.blob ?? value;
};
const storedAt = (value) => value?.at ?? 0;
export const deleteImage = (id) => tx("readwrite", (s) => s.delete(id));
const saveBlob = (id, blob) => tx("readwrite", (s) => s.put({ blob, at: Date.now() }, id));
const allEntries = () =>
  tx("readonly", (s) => {
    const out = [];
    s.openCursor().onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) return;
      out.push([cursor.key, cursor.value]);
      cursor.continue();
    };
    return out;
  });

// Shrinks a picked or captured photo and stores it. Returns its id.
export async function addImage(file) {
  if (!file?.type?.startsWith("image/")) throw new Error("That file isn't a picture.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // transparent PNGs get a white background, like paper
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const toBlob = (type, q) => new Promise((r) => canvas.toBlob(r, type, q));
  let blob = await toBlob("image/webp", 0.82);
  if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg", 0.85);
  if (!blob || blob.size > MAX_IMAGE_BYTES) throw new Error("That picture is too big, even after shrinking.");
  const id = uid();
  await saveBlob(id, blob);
  addedThisSession.add(id);
  return id;
}

// Object URLs for <img> tags, cached per id for this page load.
const urls = new Map();
export async function imageUrl(id) {
  if (urls.has(id)) return urls.get(id);
  const blob = await getImage(id).catch(() => null);
  const url = blob ? URL.createObjectURL(blob) : null;
  if (url) urls.set(id, url); // don't remember "missing": it may be imported later
  return url;
}

// Renders a slot for a card's picture; hydrateImages() puts the real <img>
// in once it's loaded, so no empty or broken image ever shows.
export const imageSlot = (image) =>
  image ? `<span class="card-img-slot" data-image-id="${image.id}" data-alt="${escAttr(image.alt ?? "")}"></span>` : "";
const escAttr = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Fills every slot under root. Missing pictures (e.g. added on another device,
// which sync doesn't carry) get a short note instead.
export async function hydrateImages(root, alt = "Card picture") {
  for (const slot of root.querySelectorAll(".card-img-slot[data-image-id]")) {
    const url = await imageUrl(slot.dataset.imageId);
    if (!slot.isConnected) continue;
    if (url) slot.replaceWith(Object.assign(document.createElement("img"), { className: "card-img", src: url, alt: slot.dataset.alt || alt }));
    else slot.replaceWith(Object.assign(document.createElement("span"), { className: "image-missing", textContent: "Picture is on another device" }));
  }
}

// Pictures added since the page loaded may belong to an editor that hasn't
// saved yet, so cleanup leaves them alone until the next visit.
const addedThisSession = new Set();

// Removes stored pictures no card uses anymore.
// Pictures stored in the last day are kept too: another tab may have an
// editor open with a picture it hasn't saved yet.
export async function collectGarbage(decks) {
  const entries = await allEntries().catch(() => []);
  const used = new Set([...addedThisSession, ...decks.flatMap((d) => d.cards.map((c) => c.image?.id).filter(Boolean))]);
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const unused = entries.filter(([id, value]) => !used.has(id) && storedAt(value) < dayAgo).map(([id]) => id);
  await Promise.all(unused.map((id) => deleteImage(id).catch(() => {})));
}

// For backups and shared decks: pictures as data URLs, and back.
export async function exportImages(ids) {
  const out = {};
  for (const id of new Set(ids)) {
    const blob = await getImage(id).catch(() => null);
    if (!blob) continue;
    out[id] = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }
  return out;
}

export async function importImages(images) {
  for (const [id, dataUrl] of Object.entries(images ?? {})) {
    const blob = await (await fetch(dataUrl)).blob();
    await saveBlob(id, blob);
    addedThisSession.add(id);
  }
}
