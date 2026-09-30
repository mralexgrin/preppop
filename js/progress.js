// Numbers for the Progress page, computed from saved state. Pure.

import { addDays, isDue } from "./srs.js";
import { SUBJECTS } from "./subjects.js";

export function longestStreak(activity) {
  const days = Object.keys(activity).filter((d) => activity[d]?.answered).sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const day of days) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}

// Totals for the 7 days ending today.
export function weekSummary(activity, today) {
  let answered = 0;
  let correct = 0;
  let days = 0;
  for (let i = 0; i < 7; i++) {
    const a = activity[addDays(today, -i)];
    if (!a?.answered) continue;
    answered += a.answered;
    correct += a.correct;
    days++;
  }
  return { answered, correct, days, accuracy: answered ? Math.round((correct / answered) * 100) : null };
}

// Calendar cells for the last `weeks` weeks, oldest first, in columns of 7
// (Sunday to Saturday), ending with the week that contains today.
export function calendar(activity, today, weeks = 12) {
  const [y, m, d] = today.split("-").map(Number);
  const weekday = new Date(y, m - 1, d, 12).getDay();
  const start = addDays(today, -(weeks * 7 - 1) + (6 - weekday));
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const day = addDays(start, i);
    const count = activity[day]?.answered ?? 0;
    const level = day > today ? -1 : count === 0 ? 0 : count < 10 ? 1 : count < 25 ? 2 : count < 50 ? 3 : 4;
    cells.push({ day, count, level });
  }
  return cells;
}

export function subjectMastery(decks) {
  return SUBJECTS.map((subject) => {
    const cards = decks.filter((d) => d.subject === subject.id).flatMap((d) => d.cards);
    const known = cards.filter((c) => c.status === "known").length;
    const learning = cards.filter((c) => c.status === "learning").length;
    return { subject, total: cards.length, known, learning, pct: cards.length ? Math.round((known / cards.length) * 100) : 0 };
  }).filter((s) => s.total);
}

// Cards missed most often, then most recently missed; only ones she still gets wrong.
export function weakCards(decks, limit = 8) {
  return decks
    .flatMap((deck) => deck.cards.map((card) => ({ deck, card })))
    .filter(({ card }) => (card.stats?.missed ?? 0) > 0 && card.status !== "known")
    .sort((a, b) => b.card.stats.missed - a.card.stats.missed || (b.card.srs?.last ?? "").localeCompare(a.card.srs?.last ?? ""))
    .slice(0, limit);
}

export function upcoming(decks, today) {
  const cards = decks.flatMap((d) => d.cards);
  const dueBy = (day) => cards.filter((c) => isDue(c, day)).length;
  return { today: dueBy(today), tomorrow: dueBy(addDays(today, 1)), week: dueBy(addDays(today, 7)) };
}

// A short plain-text summary to share (e.g. with a parent).
export function progressSummary({ streakDays, week, mastery, next }) {
  const lines = ["My PrepPop progress"];
  lines.push(`Streak: ${streakDays} day${streakDays === 1 ? "" : "s"}`);
  lines.push(`This week: ${week.answered} card${week.answered === 1 ? "" : "s"} practiced${week.accuracy === null ? "" : `, ${week.accuracy}% right`}`);
  for (const m of mastery) lines.push(`${m.subject.name}: ${m.known} of ${m.total} card${m.total === 1 ? "" : "s"} known`);
  if (next.today) lines.push(`${next.today} card${next.today === 1 ? "" : "s"} to review today`);
  return lines.join("\n");
}
