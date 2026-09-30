import { test } from "node:test";
import assert from "node:assert/strict";
import { longestStreak, weekSummary, calendar, subjectMastery, weakCards, upcoming, progressSummary } from "../js/progress.js";

const T = "2026-09-30"; // a Wednesday

test("longestStreak finds the best run of consecutive days", () => {
  const activity = {
    "2026-09-01": { answered: 1 },
    "2026-09-02": { answered: 3 },
    "2026-09-03": { answered: 2 },
    "2026-09-10": { answered: 1 },
    "2026-09-11": { answered: 0 },
    "2026-09-30": { answered: 5 },
  };
  assert.equal(longestStreak(activity), 3);
  assert.equal(longestStreak({}), 0);
});

test("weekSummary totals the last 7 days", () => {
  const activity = { [T]: { answered: 10, correct: 8 }, "2026-09-25": { answered: 10, correct: 6 }, "2026-09-20": { answered: 50, correct: 50 } };
  assert.deepEqual(weekSummary(activity, T), { answered: 20, correct: 14, days: 2, accuracy: 70 });
  assert.equal(weekSummary({}, T).accuracy, null);
});

test("calendar ends on the Saturday of this week, in whole weeks", () => {
  const cells = calendar({ [T]: { answered: 30 } }, T, 2);
  assert.equal(cells.length, 14);
  assert.equal(cells[0].day, "2026-09-20"); // a Sunday
  assert.equal(cells.at(-1).day, "2026-10-03"); // Saturday
  assert.equal(cells.find((c) => c.day === T).level, 3);
  assert.equal(cells.at(-1).level, -1); // future
});

test("subjectMastery counts known cards per subject", () => {
  const decks = [
    { subject: "biology", cards: [{ status: "known" }, { status: "learning" }, { status: "new" }, { status: "known" }] },
    { subject: "spanish", cards: [] },
  ];
  const out = subjectMastery(decks);
  assert.equal(out.length, 1);
  assert.deepEqual({ id: out[0].subject.id, known: out[0].known, learning: out[0].learning, pct: out[0].pct }, { id: "biology", known: 2, learning: 1, pct: 50 });
});

test("weakCards lists the most-missed cards she hasn't learned yet", () => {
  const deck = {
    cards: [
      { id: "a", status: "learning", stats: { seen: 5, missed: 3 } },
      { id: "b", status: "known", stats: { seen: 9, missed: 5 } },
      { id: "c", status: "learning", stats: { seen: 2, missed: 1 } },
      { id: "d", status: "new" },
    ],
  };
  assert.deepEqual(weakCards([deck]).map((x) => x.card.id), ["a", "c"]);
});

test("upcoming counts cards due today, tomorrow, and within a week", () => {
  const decks = [{ cards: [{ srs: { due: T } }, { srs: { due: "2026-10-01" } }, { srs: { due: "2026-10-05" } }, { srs: { due: "2026-11-01" } }, {}] }];
  assert.deepEqual(upcoming(decks, T), { today: 1, tomorrow: 2, week: 3 });
});

test("progressSummary reads naturally", () => {
  const text = progressSummary({
    streakDays: 1,
    week: { answered: 42, accuracy: 81 },
    mastery: [{ subject: { name: "Biology" }, known: 10, total: 16 }],
    next: { today: 3 },
  });
  assert.equal(text, "My PrepPop progress\nStreak: 1 day\nThis week: 42 cards practiced, 81% right\nBiology: 10 of 16 cards known\n3 cards to review today");
});

test("progressSummary says 'card' for one", () => {
  const text = progressSummary({ streakDays: 0, week: { answered: 1, accuracy: null }, mastery: [{ subject: { name: "History" }, known: 0, total: 1 }], next: { today: 0 } });
  assert.equal(text, "My PrepPop progress\nStreak: 0 days\nThis week: 1 card practiced\nHistory: 0 of 1 card known");
});
