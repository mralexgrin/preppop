// Backup files (everything) and deck files (one deck to share), plus reading
// them back. Files come from outside the app, so everything is validated and
// cleaned before it touches saved state.

import { uid } from "./util.js";
import { migrate } from "./store.js";
import { isSubject } from "./subjects.js";

const FORMAT = "preppop";
const MAX_TEXT = 2000;
const MAX_CARDS = 5000;
const MAX_DECKS = 500;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function makeBackup(state, now = new Date()) {
  return {
    format: FORMAT,
    kind: "backup",
    version: 1,
    createdAt: now.toISOString(),
    decks: state.decks,
    activity: state.activity,
    settings: state.settings,
  };
}

// A deck to hand to a classmate: just the cards, no personal progress.
export function makeDeckFile(deck, now = new Date()) {
  return {
    format: FORMAT,
    kind: "deck",
    version: 1,
    createdAt: now.toISOString(),
    deck: {
      name: deck.name,
      subject: deck.subject,
      cards: deck.cards.map(({ term, definition }) => ({ term, definition })),
    },
  };
}

const text = (v) => (typeof v === "string" ? v.slice(0, MAX_TEXT) : "");

function cleanDeck(deck, { freshIds }) {
  const cards = (Array.isArray(deck?.cards) ? deck.cards : [])
    .slice(0, MAX_CARDS)
    .map((c) => {
      const card = { id: freshIds || typeof c?.id !== "string" ? uid() : c.id, term: text(c?.term).trim(), definition: text(c?.definition).trim() };
      if (!freshIds) {
        if (["new", "learning", "known"].includes(c?.status)) card.status = c.status;
        if (c?.srs && typeof c.srs.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.srs.due) && Number.isInteger(c.srs.box)) {
          card.srs = { box: Math.max(0, Math.min(7, c.srs.box)), due: c.srs.due, ...(DAY.test(c.srs.last) ? { last: c.srs.last } : {}) };
        }
      }
      card.status ??= "new";
      return card;
    })
    .filter((c) => c.term && c.definition);
  return {
    id: freshIds || typeof deck?.id !== "string" ? uid() : deck.id,
    name: text(deck?.name).trim().slice(0, 120) || "Imported deck",
    subject: deck?.subject,
    createdAt: Number.isFinite(deck?.createdAt) ? deck.createdAt : Date.now(),
    cards,
  };
}

// Returns { kind, decks, activity?, settings?, createdAt } or throws with a
// message that can be shown to the student.
export function readFile(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("That file isn't a PrepPop backup or deck.");
  }
  if (data?.format !== FORMAT) throw new Error("That file isn't a PrepPop backup or deck.");

  if (data.kind === "deck") {
    const deck = cleanDeck(data.deck, { freshIds: true });
    if (!deck.cards.length) throw new Error("That deck file has no cards in it.");
    return { kind: "deck", decks: migrate({ decks: [deck] }).decks, createdAt: data.createdAt };
  }
  if (data.kind === "backup") {
    const decks = (Array.isArray(data.decks) ? data.decks : []).slice(0, MAX_DECKS).map((d) => cleanDeck(d, { freshIds: false }));
    const cleaned = migrate({ decks, activity: cleanActivity(data.activity), settings: cleanSettings(data.settings) });
    return { kind: "backup", decks: cleaned.decks, activity: cleaned.activity, settings: cleaned.settings, createdAt: data.createdAt };
  }
  throw new Error("That file isn't a PrepPop backup or deck.");
}

function cleanActivity(activity) {
  const out = {};
  if (!activity || typeof activity !== "object") return out;
  for (const [day, v] of Object.entries(activity)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const answered = Math.max(0, Math.floor(Number(v?.answered) || 0));
    const correct = Math.min(answered, Math.max(0, Math.floor(Number(v?.correct) || 0)));
    if (answered) out[day] = { answered, correct };
  }
  return out;
}

function cleanSettings(settings) {
  const out = {};
  if (Number.isInteger(settings?.dailyGoal) && settings.dailyGoal > 0 && settings.dailyGoal <= 500) out.dailyGoal = settings.dailyGoal;
  if (isSubject(settings?.lastSubject)) out.lastSubject = settings.lastSubject;
  return out;
}

// Adds decks that aren't already here (matched by id). Existing decks win.
export function mergeDecks(existing, incoming) {
  const ids = new Set(existing.map((d) => d.id));
  const added = incoming.filter((d) => !ids.has(d.id));
  return { decks: [...existing, ...added], added: added.length, skipped: incoming.length - added.length };
}

// Adds practice history from a backup to what's already here, day by day,
// keeping the larger count so restoring twice doesn't double anything.
export function mergeActivity(existing, incoming) {
  const out = { ...existing };
  for (const [day, v] of Object.entries(incoming)) {
    const mine = out[day];
    out[day] = !mine || v.answered > mine.answered ? v : mine;
  }
  return out;
}
