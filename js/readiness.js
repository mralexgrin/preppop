// Test readiness: a rough estimate of how much of a deck she'd remember on
// the test date, and how many cards a day would get her to the goal. Pure.
//
// The memory model is deliberately simple and matches the review schedule
// (js/srs.js): a card answered right lands in a box whose interval is the
// gap at which she should still remember it about 90% of the time, so recall
// fades as 0.9^(days since last practice / interval). A card she just missed
// starts low, a lucky guess a bit higher, and both fade fast; a card she's
// never practiced counts as not known. It's an estimate, and the app says so.

import { INTERVALS, MAX_BOX, addDays, daysUntil } from "./srs.js";

export const GOAL = 0.9;
export const SECONDS_PER_CARD = 12; // a flip or a typed answer, with a moment to think
export const DAILY_OPTIONS = [5, 10, 15, 20, 30, 40, 60];

const MISSED_START = 0.2; // just got it wrong
const LEARNING_START = 0.5; // got it right but not sure yet (a guess), or seen once

export const pct = (x) => Math.round(x * 100);
const reachesGoal = (x) => pct(x) >= pct(GOAL);

// A card's state as numbers of days from `today`, so the simulation does no
// date parsing. Older cards may have a schedule but no "last practiced" date
// (from before it was recorded, or from a backup): it's worked out from the
// due date and the box.
function toState(card, today) {
  const srs = card.srs;
  if (!srs) return { seen: false };
  const box = Number.isInteger(srs.box) ? Math.max(0, Math.min(srs.box, MAX_BOX)) : 0;
  const due = daysUntil(today, srs.due);
  const last = srs.last ? daysUntil(today, srs.last) : due - INTERVALS[box];
  return { seen: true, known: card.status === "known" && box > 0, box, last, due };
}

function recall(s, day) {
  if (!s.seen) return 0;
  const t = Math.max(0, day - s.last);
  if (s.known) return 0.9 ** (t / INTERVALS[s.box]);
  // Not known yet: due the same day it was last practiced means she missed it.
  return (s.due <= s.last ? MISSED_START : LEARNING_START) * 0.9 ** t;
}

// Chance she recalls the card on `day`.
export const recallOn = (card, day, today = day) => recall(toState(card, today), daysUntil(today, day));

// Average recall across the deck on `day`, 0..1.
export function readinessOn(cards, day, today = day) {
  if (!cards.length) return 0;
  const d = daysUntil(today, day);
  return cards.reduce((n, c) => n + recall(toState(c, today), d), 0) / cards.length;
}

// What practicing `perDay` cards from this deck every day until the test
// would do. Each day she reviews the due cards she's weakest on. A new card
// becomes "learning"; a learning card moves up a box like an answer marked
// right (relearning); a known card she'd probably remember moves up a box,
// one she wouldn't starts over. Reviews come back by the day before the test,
// like the app's schedule.
export function simulate(cards, today, examDate, perDay) {
  const sim = cards.map((c) => toState(c, today));
  const exam = daysUntil(today, examDate);
  const lastDay = exam - 1;
  for (let day = 0; day <= lastDay; day++) {
    const todays = [];
    for (let i = 0; i < sim.length; i++) {
      const s = sim[i];
      if (!s.seen || s.due <= day) todays.push({ i, p: recall(s, day) });
    }
    todays.sort((a, b) => a.p - b.p);
    for (const { i, p } of todays.slice(0, perDay)) {
      const s = sim[i];
      if (!s.seen) sim[i] = { seen: true, known: false, box: 0, last: day, due: day + 1 };
      else if (!s.known || p >= 0.5) {
        const box = Math.min(s.box + 1, MAX_BOX);
        sim[i] = { seen: true, known: true, box, last: day, due: Math.min(day + INTERVALS[box], lastDay) };
      } else sim[i] = { seen: true, known: false, box: 0, last: day, due: day + 1 };
    }
  }
  return sim.reduce((n, s) => n + recall(s, exam), 0) / (sim.length || 1);
}

// { now, ifNothing, plan: { perDay, minutes, reaches, wholeDeck } | null, days, size }
// now: readiness today; ifNothing: on the test date with no more practice;
// plan: the smallest daily amount that reaches the goal (or the most that
// makes sense, if none does). No plan when there's nothing to plan for.
export function forecast(deck, today) {
  const cards = deck.cards;
  const days = daysUntil(today, deck.examDate);
  const now = readinessOn(cards, today);
  const ifNothing = days > 0 ? readinessOn(cards, deck.examDate, today) : now;
  const base = { now, ifNothing, plan: null, days, size: cards.length };
  if (days <= 1 || !cards.length || reachesGoal(ifNothing)) return base;
  let plan = null;
  for (const option of DAILY_OPTIONS) {
    const perDay = Math.min(option, cards.length);
    const reaches = simulate(cards, today, deck.examDate, perDay);
    plan = { perDay, minutes: Math.max(1, Math.round((perDay * SECONDS_PER_CARD) / 60)), reaches, wholeDeck: perDay === cards.length };
    if (reachesGoal(reaches) || plan.wholeDeck) break;
  }
  return { ...base, plan };
}

// One or two plain sentences for the Today banner and Progress.
export function readinessText(f) {
  const ready = `You're about ${pct(f.now)}% ready`;
  const readyNow = reachesGoal(f.now);
  if (f.days <= 0) return readyNow ? `${ready}. A quick look this morning is all you need.` : `${ready}. A last quick review of the cards you don't know yet will help most.`;
  if (f.days === 1) {
    return readyNow
      ? `${ready}. A quick review tonight keeps it there.`
      : `${ready}. Tonight, go through all ${f.size} card${f.size === 1 ? "" : "s"} until you know each one, then take a quick look in the morning.`;
  }
  if (reachesGoal(f.ifNothing) || !f.plan) return `${ready}. A short review each day keeps it there.`;
  const { perDay, minutes, reaches, wholeDeck } = f.plan;
  const daily = wholeDeck ? `going through the whole deck each day (about ${minutes} min)` : `${perDay} cards a day from this deck (about ${minutes} min)`;
  if (readyNow) return `${ready} now, but it fades without review: ${daily} keeps you around ${pct(reaches)}%.`;
  if (reachesGoal(reaches)) return `${ready}. ${capital(daily)} until the test should get you to about ${pct(reaches)}%.`;
  return `${ready}. ${capital(daily)} gets you to about ${Math.floor(reaches * 100)}%.${wholeDeck ? "" : " There's a lot to cover, so start today."}`;
}

const capital = (s) => s[0].toUpperCase() + s.slice(1);
