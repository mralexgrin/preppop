// Saved state: decks, cards, and cached AI answers, kept in localStorage.

import { uid } from "./util.js";
import { isSubject } from "./subjects.js";
import { dayKey, grade, seedSchedule } from "./srs.js";
import { normalizeSyncKey } from "./sync.js";
import { MAX_COUNT as MAX_MIXUPS } from "./mixups.js";

export const STORE_KEY = "preppop:v1";
// The active profile's key (see js/profiles.js); the first profile uses STORE_KEY.
let storeKey = STORE_KEY;
export const setStoreKey = (key) => (storeKey = key);

export const state = { decks: [], distractors: {}, settings: {}, activity: {}, deletedDecks: {}, sync: null, explanations: {} };

export const DEFAULT_DAILY_GOAL = 20;

// Ids end up inside HTML attributes and URLs, so only plain ones are kept.
export const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const STATUSES = ["new", "learning", "known"];

const count = (n) => (Number.isInteger(n) && n >= 0 ? Math.min(n, 1e6) : 0);
function cleanStats(stats) {
  // Returns undefined for "no stats"; migrate removes the key in that case.
  if (!stats || typeof stats !== "object") return undefined;
  const seen = count(stats.seen);
  const out = { seen, missed: Math.min(seen, count(stats.missed)) };
  // Confidence check (Test mode): answers marked sure or guessing, and how they went.
  const sure = Math.min(seen, count(stats.sure));
  const guess = Math.min(seen - sure, count(stats.guess));
  if (sure) out.sure = sure;
  if (sure && out.missed && count(stats.sureMissed)) out.sureMissed = Math.min(sure, out.missed, count(stats.sureMissed));
  if (guess) out.guess = guess;
  if (guess && count(stats.guessRight)) out.guessRight = Math.min(guess, count(stats.guessRight));
  return out;
}

// { otherCardId: count } for cards in the same deck she's confused this one with.
export function cleanMixups(mixups, cardIds) {
  if (!mixups || typeof mixups !== "object" || Array.isArray(mixups)) return undefined;
  const out = Object.fromEntries(
    Object.entries(mixups)
      .filter(([id, n]) => SAFE_ID.test(id) && (!cardIds || cardIds.has(id)) && Number.isInteger(n) && n > 0)
      .map(([id, n]) => [id, Math.min(MAX_MIXUPS, n)]),
  );
  return Object.keys(out).length ? out : undefined;
}

// { id: timestamp } maps (deletion markers), keeping only safe ids and numbers.
const cleanStamps = (stamps) =>
  stamps && typeof stamps === "object" && !Array.isArray(stamps)
    ? Object.fromEntries(Object.entries(stamps).filter(([id, at]) => SAFE_ID.test(id) && Number.isFinite(at)))
    : {};

const isDay = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

// A card's picture reference: { id, side }. The picture itself is in IndexedDB.
const cleanImageRef = (image) =>
  image && SAFE_ID.test(image.id) && ["term", "definition"].includes(image.side)
    ? { id: image.id, side: image.side, ...(typeof image.alt === "string" && image.alt.trim() ? { alt: image.alt.trim().slice(0, 150) } : {}) }
    : undefined;

const withoutEmpty = (card) => {
  if (card.stats === undefined) delete card.stats;
  if (card.image === undefined) delete card.image;
  if (card.hint === undefined) delete card.hint;
  if (card.mixups === undefined) delete card.mixups;
  return card;
};

function safeId(id, seen) {
  const ok = typeof id === "string" && SAFE_ID.test(id) && !seen.has(id);
  const out = ok ? id : uid();
  seen.add(out);
  return out;
}
export const hooks = { onPersistError: null, onChange: null };

// Turns whatever was saved (any older shape) into the current shape.
export function migrate(saved, today = dayKey()) {
  const { apiKey, ...rest } = saved && typeof saved === "object" ? saved : {};
  const out = { decks: [], distractors: {}, settings: {}, activity: {}, deletedDecks: {}, sync: null, explanations: {}, ...rest };
  const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);
  for (const key of ["distractors", "settings", "activity", "deletedDecks", "explanations"]) if (!isObject(out[key])) out[key] = {};
  out.explanations = Object.fromEntries(
    Object.entries(out.explanations)
      .filter(([, x]) => isObject(x) && typeof x.explanation === "string" && x.explanation)
      .map(([k, x]) => [k, Object.fromEntries(["explanation", "example", "memoryTrick", "cardIssue"].map((f) => [f, typeof x[f] === "string" ? x[f].slice(0, 1200) : ""]))]),
  );
  out.deletedDecks = cleanStamps(out.deletedDecks);
  const syncKey = normalizeSyncKey(out.sync?.key);
  out.sync = syncKey
    ? {
        key: syncKey,
        version: Number.isInteger(out.sync.version) && out.sync.version >= 0 ? out.sync.version : 0,
        lastSync: Number.isFinite(out.sync.lastSync) ? out.sync.lastSync : null,
      }
    : null;
  const deckIds = new Set();
  out.decks = (Array.isArray(out.decks) ? out.decks : [])
    .filter(isObject)
    .map((deck) => {
      const cardIds = new Set();
      const { examDate, starter, ...rest } = deck;
      return {
        ...rest,
        id: safeId(deck.id, deckIds),
        name: typeof deck.name === "string" ? deck.name : "Untitled deck",
        subject: isSubject(deck.subject) ? deck.subject : "other",
        ordered: deck.ordered === true,
        ...(isDay(deck.examDate) ? { examDate: deck.examDate } : {}),
        ...(typeof starter === "string" && SAFE_ID.test(starter) ? { starter } : {}),
        deletedCards: cleanStamps(deck.deletedCards),
        updatedAt: Number.isFinite(deck.updatedAt) ? deck.updatedAt : Number.isFinite(deck.createdAt) ? deck.createdAt : 0,
        cards: (Array.isArray(deck.cards) ? deck.cards : []).filter(isObject).map((card) =>
          withoutEmpty(seedSchedule(
            {
              ...card,
              id: safeId(card.id, cardIds),
              term: typeof card.term === "string" ? card.term : "",
              definition: typeof card.definition === "string" ? card.definition : "",
              status: STATUSES.includes(card.status) ? card.status : "new",
              stats: cleanStats(card.stats),
              hint: typeof card.hint === "string" && card.hint.trim() ? card.hint.slice(0, 300) : undefined,
              image: cleanImageRef(card.image),
            },
            today,
          )),
        ),
      };
    });
  for (const deck of out.decks) {
    const ids = new Set(deck.cards.map((c) => c.id));
    for (const card of deck.cards) {
      ids.delete(card.id);
      card.mixups = cleanMixups(card.mixups, ids);
      ids.add(card.id);
      withoutEmpty(card);
    }
  }
  if (!isSubject(out.settings.lastSubject)) delete out.settings.lastSubject;
  if (out.settings.introDone !== undefined && out.settings.introDone !== true) delete out.settings.introDone;
  if (out.settings.shortcuts !== undefined && typeof out.settings.shortcuts !== "boolean") delete out.settings.shortcuts;
  if (out.settings.reminderTime !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(out.settings.reminderTime)) delete out.settings.reminderTime;
  if (out.settings.matchBest !== undefined) out.settings.matchBest = cleanStamps(out.settings.matchBest);
  const goal = out.settings.dailyGoal;
  if (goal !== undefined && !(Number.isInteger(goal) && goal > 0 && goal <= 500)) delete out.settings.dailyGoal;
  return out;
}

export function load(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(storeKey);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    Object.assign(state, migrate(parsed));
    // Keys were stored here before the answer service existed; drop them.
    if ("apiKey" in parsed) persist(storage);
  } catch {
    // Unreadable or blocked storage: start empty rather than crash.
  }
}

export function persist(storage = globalThis.localStorage, { quiet = false } = {}) {
  try {
    storage.setItem(storeKey, JSON.stringify(state));
    if (!quiet) hooks.onChange?.();
    return true;
  } catch {
    hooks.onPersistError?.();
    return false;
  }
}

export const getDeck = (id) => state.decks.find((d) => d.id === id);
export const blankCard = () => ({ id: uid(), term: "", definition: "", status: "new" });

// Schedules the card's next review and counts the answer toward today's practice.
// deck (optional): lets a coming test pull the next review earlier.
// confidence (optional): "sure" or "guess", from Test mode's confidence check.
// count: false leaves today's practice count alone (Word Builder counts once
// per word with countPractice, though one word grades 2-3 part cards).
// Returns undo(), which puts the card and today's count back exactly as they were.
export function recordAnswer(card, correct, today = dayKey(), deck = null, { confidence = null, count = true } = {}) {
  const before = { status: card.status, srs: card.srs, stats: card.stats };
  Object.assign(card, grade(card, correct, today, deck?.examDate ?? null, { guessed: correct && confidence === "guess" }));
  const stats = card.stats ?? { seen: 0, missed: 0 };
  card.stats = { ...stats, seen: stats.seen + 1, missed: stats.missed + (correct ? 0 : 1) };
  if (confidence === "sure") {
    card.stats.sure = (stats.sure ?? 0) + 1;
    if (!correct) card.stats.sureMissed = (stats.sureMissed ?? 0) + 1;
  } else if (confidence === "guess") {
    card.stats.guess = (stats.guess ?? 0) + 1;
    if (correct) card.stats.guessRight = (stats.guessRight ?? 0) + 1;
  }
  if (count) countPractice(correct, today);
  return function undo() {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete card[key];
      else card[key] = value;
    }
    if (!count) return;
    const d = state.activity[today];
    if (!d) return;
    d.answered = Math.max(0, d.answered - 1);
    if (correct) d.correct = Math.max(0, d.correct - 1);
    if (!d.answered) delete state.activity[today];
  };
}

// One answer toward today's practice (the daily goal and streak).
export function countPractice(correct, today = dayKey()) {
  const day = (state.activity[today] ??= { answered: 0, correct: 0 });
  day.answered++;
  if (correct) day.correct++;
}

export const dailyGoal = () => state.settings.dailyGoal ?? DEFAULT_DAILY_GOAL;

// Single-key shortcuts (arrows, 1-4, T/F, S/G) can be turned off in Settings.
export const shortcutsOn = () => state.settings.shortcuts !== false;

// Removes a deck and remembers the deletion so synced devices drop it too.
export function deleteDeck(deck) {
  state.decks = state.decks.filter((d) => d !== deck);
  state.deletedDecks[deck.id] = Date.now();
}

// Call when a deck's name, subject, or cards change (not when it's studied).
export const touch = (deck) => (deck.updatedAt = Date.now());

// Remembers cards removed from a deck so synced devices drop them too.
export function forgetCards(deck, removedIds) {
  const now = Date.now();
  deck.deletedCards = { ...(deck.deletedCards ?? {}) };
  for (const id of removedIds) deck.deletedCards[id] = now;
}
