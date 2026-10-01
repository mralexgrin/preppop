// Spaced repetition: a simple box (Leitner) schedule. Each correct answer on a
// due card moves it up a box and further into the future; a miss sends it back
// to box 0, due today. Dates are local "YYYY-MM-DD" keys so "today" matches
// the student's own calendar.

// Days until the next review after landing in each box.
export const INTERVALS = [0, 1, 3, 7, 14, 30, 60, 120];
export const MAX_BOX = INTERVALS.length - 1;
export const ROUND_SIZE = 20;

const pad = (n) => String(n).padStart(2, "0");
export const dayKey = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function addDays(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + n, 12)); // noon avoids DST edge cases
}

export const isNew = (card) => !card.srs;
export const isDue = (card, today) => Boolean(card.srs) && card.srs.due <= today;

// Returns the card's new fields after an answer. Doesn't mutate.
// examDate (optional, "YYYY-MM-DD"): the deck has a test coming up, so a
// known card comes back no later than the day before it (or the morning of
// the test, if that's tomorrow).
export function grade(card, correct, today, examDate = null) {
  if (!correct) return { status: "learning", srs: { box: 0, due: today, last: today } };
  // Right again before it's due (e.g. flipping through a deck twice in one
  // night) doesn't push it further out.
  if (card.srs && card.srs.due > today) return { status: "known", srs: { ...card.srs, last: today } };
  const box = Math.min((card.srs?.box ?? 0) + 1, MAX_BOX);
  let due = addDays(today, INTERVALS[box]);
  if (examDate && examDate > today) {
    const dayBefore = addDays(examDate, -1);
    const cap = dayBefore > today ? dayBefore : examDate;
    if (due > cap) due = cap;
  }
  return { status: "known", srs: { box, due, last: today } };
}

export const daysUntil = (from, to) => {
  const [a, b] = [from, to].map((k) => {
    const [y, m, d] = k.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86400000);
};

// Cards across all decks that are due, most overdue and least known first.
export function dueCards(decks, today) {
  return decks
    .flatMap((deck) => deck.cards.filter((card) => isDue(card, today)).map((card) => ({ deck, card })))
    .sort((a, b) => a.card.srs.due.localeCompare(b.card.srs.due) || a.card.srs.box - b.card.srs.box);
}

// Consecutive days with practice, ending today (or yesterday if today has
// no practice yet, so the streak doesn't look broken first thing in the morning).
export function streak(activity, today) {
  let day = activity[today]?.answered ? today : addDays(today, -1);
  let n = 0;
  while (activity[day]?.answered) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

// Gives cards saved before spaced repetition existed a starting schedule.
export function seedSchedule(card, today) {
  if (card.srs) return card;
  if (card.status === "learning") return { ...card, srs: { box: 0, due: today } };
  if (card.status === "known") return { ...card, srs: { box: 1, due: addDays(today, 1) } };
  return card;
}
