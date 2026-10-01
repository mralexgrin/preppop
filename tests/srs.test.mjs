import { test } from "node:test";
import assert from "node:assert/strict";
import { grade, addDays, dayKey, isDue, isNew, dueCards, streak, seedSchedule, daysUntil, INTERVALS, MAX_BOX } from "../js/srs.js";

const T = "2026-09-30";

test("dayKey uses the local calendar date", () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
});

test("addDays crosses months, years, and DST", () => {
  assert.equal(addDays("2026-01-31", 1), "2026-02-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-08", 1), "2026-03-09"); // US DST start
  assert.equal(addDays("2026-11-01", 1), "2026-11-02"); // US DST end
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("a new card answered right goes to box 1, due tomorrow", () => {
  const out = grade({ id: "c" }, true, T);
  assert.deepEqual(out, { status: "known", srs: { box: 1, due: "2026-10-01", last: T } });
});

test("a due card answered right moves up a box", () => {
  const out = grade({ srs: { box: 2, due: T } }, true, T);
  assert.equal(out.srs.box, 3);
  assert.equal(out.srs.due, addDays(T, INTERVALS[3]));
});

test("right again before it's due doesn't move it further out", () => {
  const card = { srs: { box: 1, due: "2026-10-01", last: T } };
  const out = grade(card, true, T);
  assert.equal(out.srs.box, 1);
  assert.equal(out.srs.due, "2026-10-01");
});

test("a miss always goes back to box 0, due today", () => {
  const out = grade({ srs: { box: 5, due: "2026-12-01" } }, false, T);
  assert.deepEqual(out, { status: "learning", srs: { box: 0, due: T, last: T } });
});

test("box is capped", () => {
  const out = grade({ srs: { box: MAX_BOX, due: T } }, true, T);
  assert.equal(out.srs.box, MAX_BOX);
});

test("isDue and isNew", () => {
  assert.equal(isNew({}), true);
  assert.equal(isDue({}, T), false);
  assert.equal(isDue({ srs: { due: T } }, T), true);
  assert.equal(isDue({ srs: { due: "2026-09-01" } }, T), true);
  assert.equal(isDue({ srs: { due: "2026-10-01" } }, T), false);
});

test("dueCards lists due cards across decks, most overdue first", () => {
  const decks = [
    { id: "a", cards: [{ id: 1, srs: { box: 2, due: T } }, { id: 2 }, { id: 3, srs: { box: 1, due: "2026-10-05" } }] },
    { id: "b", cards: [{ id: 4, srs: { box: 0, due: "2026-09-20" } }, { id: 5, srs: { box: 0, due: T } }] },
  ];
  assert.deepEqual(dueCards(decks, T).map((x) => x.card.id), [4, 5, 1]);
  assert.equal(dueCards(decks, T)[0].deck.id, "b");
});

test("streak counts consecutive practice days", () => {
  const activity = { "2026-09-28": { answered: 3 }, "2026-09-29": { answered: 5 }, [T]: { answered: 1 } };
  assert.equal(streak(activity, T), 3);
  // Nothing yet today: yesterday's streak still counts.
  assert.equal(streak({ "2026-09-28": { answered: 3 }, "2026-09-29": { answered: 5 } }, T), 2);
  // Missed yesterday: streak is broken.
  assert.equal(streak({ "2026-09-28": { answered: 3 } }, T), 0);
  assert.equal(streak({}, T), 0);
});

test("seedSchedule gives old cards a starting point", () => {
  assert.deepEqual(seedSchedule({ status: "learning" }, T).srs, { box: 0, due: T });
  assert.deepEqual(seedSchedule({ status: "known" }, T).srs, { box: 1, due: "2026-10-01" });
  assert.equal(seedSchedule({ status: "new" }, T).srs, undefined);
  const scheduled = { status: "known", srs: { box: 4, due: "2026-11-01" } };
  assert.equal(seedSchedule(scheduled, T), scheduled);
});

test("a coming test pulls the next review to the day before it", () => {
  // Box 3 would normally be 7 days out; the test is in 4 days.
  const out = grade({ srs: { box: 2, due: T } }, true, T, "2026-10-04");
  assert.equal(out.srs.box, 3);
  assert.equal(out.srs.due, "2026-10-03");
});

test("a test tomorrow brings cards back the morning of the test", () => {
  assert.equal(grade({ srs: { box: 3, due: T } }, true, T, "2026-10-01").srs.due, "2026-10-01");
});

test("a far-off or past test doesn't change the schedule", () => {
  assert.equal(grade({ srs: { box: 0, due: T } }, true, T, "2026-12-01").srs.due, "2026-10-01");
  assert.equal(grade({ srs: { box: 2, due: T } }, true, T, "2026-09-01").srs.due, addDays(T, 7));
});

test("daysUntil counts calendar days", () => {
  assert.equal(daysUntil(T, "2026-10-03"), 3);
  assert.equal(daysUntil(T, T), 0);
  assert.equal(daysUntil("2026-03-07", "2026-03-09"), 2); // across DST
});
