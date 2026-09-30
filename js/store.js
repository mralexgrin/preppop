// Saved state: decks, cards, and cached AI answers, kept in localStorage.

import { uid } from "./util.js";
import { isSubject } from "./subjects.js";
import { dayKey, grade, seedSchedule } from "./srs.js";

export const STORE_KEY = "preppop:v1";

export const state = { decks: [], distractors: {}, settings: {}, activity: {} };

export const DEFAULT_DAILY_GOAL = 20;

// Ids end up inside HTML attributes and URLs, so only plain ones are kept.
export const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const STATUSES = ["new", "learning", "known"];

const count = (n) => (Number.isInteger(n) && n >= 0 ? Math.min(n, 1e6) : 0);
function cleanStats(stats) {
  // Returns undefined for "no stats"; migrate removes the key in that case.
  if (!stats || typeof stats !== "object") return undefined;
  const seen = count(stats.seen);
  return { seen, missed: Math.min(seen, count(stats.missed)) };
}

const withoutEmpty = (card) => {
  if (card.stats === undefined) delete card.stats;
  return card;
};

function safeId(id, seen) {
  const ok = typeof id === "string" && SAFE_ID.test(id) && !seen.has(id);
  const out = ok ? id : uid();
  seen.add(out);
  return out;
}
export const hooks = { onPersistError: null };

// Turns whatever was saved (any older shape) into the current shape.
export function migrate(saved, today = dayKey()) {
  const { apiKey, ...rest } = saved && typeof saved === "object" ? saved : {};
  const out = { decks: [], distractors: {}, settings: {}, activity: {}, ...rest };
  const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);
  for (const key of ["distractors", "settings", "activity"]) if (!isObject(out[key])) out[key] = {};
  const deckIds = new Set();
  out.decks = (Array.isArray(out.decks) ? out.decks : [])
    .filter(isObject)
    .map((deck) => {
      const cardIds = new Set();
      return {
        ...deck,
        id: safeId(deck.id, deckIds),
        name: typeof deck.name === "string" ? deck.name : "Untitled deck",
        subject: isSubject(deck.subject) ? deck.subject : "other",
        ordered: deck.ordered === true,
        cards: (Array.isArray(deck.cards) ? deck.cards : []).filter(isObject).map((card) =>
          withoutEmpty(seedSchedule(
            {
              ...card,
              id: safeId(card.id, cardIds),
              term: typeof card.term === "string" ? card.term : "",
              definition: typeof card.definition === "string" ? card.definition : "",
              status: STATUSES.includes(card.status) ? card.status : "new",
              stats: cleanStats(card.stats),
            },
            today,
          )),
        ),
      };
    });
  if (!isSubject(out.settings.lastSubject)) delete out.settings.lastSubject;
  const goal = out.settings.dailyGoal;
  if (goal !== undefined && !(Number.isInteger(goal) && goal > 0 && goal <= 500)) delete out.settings.dailyGoal;
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

// Schedules the card's next review and counts the answer toward today's practice.
export function recordAnswer(card, correct, today = dayKey()) {
  Object.assign(card, grade(card, correct, today));
  const stats = card.stats ?? { seen: 0, missed: 0 };
  card.stats = { seen: stats.seen + 1, missed: stats.missed + (correct ? 0 : 1) };
  const day = (state.activity[today] ??= { answered: 0, correct: 0 });
  day.answered++;
  if (correct) day.correct++;
}

export const dailyGoal = () => state.settings.dailyGoal ?? DEFAULT_DAILY_GOAL;
