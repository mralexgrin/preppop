// Test readiness: a rough estimate of how much of a deck she'd remember on
// the test date, and how many cards a day would get her to the goal. Pure.
//
// The memory model is deliberately simple and matches the review schedule
// (js/srs.js): a card answered right lands in a box whose interval is the
// gap at which she should still remember it about 90% of the time, so recall
// fades as 0.9^(days since last review / interval). A card she's still
// learning starts lower and fades fast; a card she's never practiced counts as
// not known. It's an estimate, and the app says so.

import { INTERVALS, MAX_BOX, addDays, daysUntil } from "./srs.js";

export const GOAL = 0.9;
export const SECONDS_PER_CARD = 12; // a flip or a typed answer, with a moment to think
const DAILY_OPTIONS = [5, 10, 15, 20, 30, 40, 60];

const LEARNING_START = 0.6;

// Chance she recalls the card on `day`.
export function recallOn(card, day) {
  const srs = card.srs;
  if (!srs?.last) return 0;
  const t = Math.max(0, daysUntil(srs.last, day));
  if (card.status !== "known" || !srs.box) return LEARNING_START * 0.9 ** t;
  return 0.9 ** (t / INTERVALS[srs.box]);
}

// Average recall across the deck on the test date, 0..1.
export function readinessOn(cards, day) {
  if (!cards.length) return 0;
  return cards.reduce((n, c) => n + recallOn(c, day), 0) / cards.length;
}

// What practicing `perDay` cards every day until the test would do. Each day
// she reviews the cards she's weakest on (lowest recall today). One she'd
// probably remember moves up a box; one she wouldn't starts over as learning.
// Reviews are capped to come back by the day before the test, like the app.
export function simulate(cards, today, examDate, perDay) {
  let sim = cards.map((c) => ({ status: c.status, srs: c.srs ? { ...c.srs } : null }));
  const lastDay = addDays(examDate, -1);
  for (let day = today; day <= lastDay; day = addDays(day, 1)) {
    const order = sim
      .map((c, i) => ({ i, p: recallOn(c, day), due: !c.srs?.last || c.srs.due <= day }))
      .filter((x) => x.due)
      .sort((a, b) => a.p - b.p)
      .slice(0, perDay);
    for (const { i, p } of order) {
      const c = sim[i];
      if (!c.srs?.last) sim[i] = { status: "learning", srs: { box: 0, due: addDays(day, 1), last: day } };
      else if (p >= 0.5 || c.status !== "known") {
        // Learning cards that she reviews move up once she's seen them before.
        const box = Math.min((c.status === "known" ? c.srs.box : 0) + 1, MAX_BOX);
        const due = [addDays(day, INTERVALS[box]), lastDay].sort()[0];
        sim[i] = { status: "known", srs: { box, due, last: day } };
      } else sim[i] = { status: "learning", srs: { box: 0, due: addDays(day, 1), last: day } };
    }
  }
  return readinessOn(sim, examDate);
}

// { now, ifNothing, plan: { perDay, minutes, reaches } | null, days }
// now: readiness if the test were today; ifNothing: on the test date with no
// more practice; plan: the smallest daily amount that reaches the goal (or the
// most that's sensible, if none does). No plan on the day of the test.
export function forecast(deck, today) {
  const cards = deck.cards;
  const days = daysUntil(today, deck.examDate);
  const now = readinessOn(cards, today);
  const ifNothing = readinessOn(cards, deck.examDate);
  if (days <= 0 || !cards.length) return { now, ifNothing, plan: null, days };
  let plan = null;
  for (const perDay of DAILY_OPTIONS) {
    const n = Math.min(perDay, cards.length);
    const reaches = simulate(cards, today, deck.examDate, n);
    plan = { perDay: n, minutes: Math.max(1, Math.round((n * SECONDS_PER_CARD) / 60)), reaches };
    if (reaches >= GOAL || n >= cards.length) break;
  }
  return { now, ifNothing, plan, days };
}

export const pct = (x) => Math.round(x * 100);

// One or two plain sentences for the Today banner and Progress.
export function readinessText(f) {
  const ready = `You're about ${pct(f.now)}% ready.`;
  if (f.days <= 0) return `${ready} A last quick review of what you don't know yet will help most.`;
  if (pct(f.ifNothing) >= pct(GOAL)) return `${ready} A short review each day keeps it there.`;
  const { perDay, minutes, reaches } = f.plan;
  const daily = `${perDay} card${perDay === 1 ? "" : "s"} a day (about ${minutes} min)`;
  return reaches >= GOAL
    ? `${ready} ${daily} until the test should get you to about ${pct(reaches)}%.`
    : `${ready} ${daily} gets you to about ${pct(reaches)}%. Start today: there's a lot to cover.`;
}
