// Saved state: decks, cards, and cached AI answers, kept in localStorage.

import { uid } from "./util.js";
import { isSubject } from "./subjects.js";

export const STORE_KEY = "preppop:v1";

export const state = { decks: [], distractors: {}, settings: {} };
export const hooks = { onPersistError: null };

// Turns whatever was saved (any older shape) into the current shape.
export function migrate(saved) {
  const { apiKey, ...rest } = saved && typeof saved === "object" ? saved : {};
  const out = { decks: [], distractors: {}, settings: {}, ...rest };
  out.decks = (Array.isArray(out.decks) ? out.decks : []).map((deck) => ({
    ...deck,
    subject: isSubject(deck.subject) ? deck.subject : "other",
    cards: Array.isArray(deck.cards) ? deck.cards : [],
  }));
  return out;
}

export function load(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(STORE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    Object.assign(state, migrate(parsed));
    // Keys were stored here before the answer service existed; drop them.
    if ("apiKey" in parsed) persist(storage);
  } catch {
    // Unreadable or blocked storage: start empty rather than crash.
  }
}

export function persist(storage = globalThis.localStorage) {
  try {
    storage.setItem(STORE_KEY, JSON.stringify(state));
    return true;
  } catch {
    hooks.onPersistError?.();
    return false;
  }
}

export const getDeck = (id) => state.decks.find((d) => d.id === id);
export const blankCard = () => ({ id: uid(), term: "", definition: "", status: "new" });
