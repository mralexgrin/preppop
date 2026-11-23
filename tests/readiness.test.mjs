import { test } from "node:test";
import assert from "node:assert/strict";
import { recallOn, readinessOn, simulate, forecast, readinessText, pct, GOAL } from "../js/readiness.js";

const T = "2026-11-23";
const many = (n, f) => Array.from({ length: n }, (_, i) => f(i));

test("recall: unpracticed cards count as not known; known cards fade with time over their interval", () => {
  assert.equal(recallOn({ status: "new" }, T), 0);
  const known = { status: "known", srs: { box: 3, due: "2026-11-30", last: T } }; // 7-day box
  assert.equal(recallOn(known, T), 1);
  assert.ok(Math.abs(recallOn(known, "2026-11-30") - 0.9) < 1e-9, "about 90% when it's due");
  assert.ok(recallOn(known, "2026-12-20") < 0.8, "fades well past due");
  const learning = { status: "learning", srs: { box: 0, due: T, last: T } };
  assert.ok(recallOn(learning, T) < 0.7 && recallOn(learning, "2026-11-26") < recallOn(learning, T));
});

test("readiness is the average recall, 0 for an empty deck", () => {
  const cards = [{ status: "new" }, { status: "known", srs: { box: 3, due: "2026-11-30", last: T } }];
  assert.equal(readinessOn(cards, T), 0.5);
  assert.equal(readinessOn([], T), 0);
});

test("practicing more each day predicts a better test day, and never past what's possible", () => {
  const cards = many(30, () => ({ status: "new" }));
  const little = simulate(cards, T, "2026-11-30", 5);
  const lots = simulate(cards, T, "2026-11-30", 20);
  assert.ok(lots > little);
  assert.ok(lots <= 1 && little >= 0);
  assert.deepEqual(cards[0], { status: "new" }, "doesn't change her real cards");
});

test("forecast finds the smallest daily amount that reaches the goal", () => {
  const deck = { examDate: "2026-11-30", cards: many(30, () => ({ status: "new" })) };
  const f = forecast(deck, T);
  assert.equal(f.days, 7);
  assert.equal(pct(f.now), 0);
  assert.ok(f.plan.reaches >= GOAL);
  assert.ok(simulate(deck.cards, T, deck.examDate, f.plan.perDay - 5) < GOAL || f.plan.perDay === 5, "a smaller option wouldn't have reached it");
  assert.equal(f.plan.minutes, Math.max(1, Math.round((f.plan.perDay * 12) / 60)));
});

test("forecast on test day has no plan; a deck she knows well needs only a light touch", () => {
  const today = { examDate: T, cards: many(5, () => ({ status: "new" })) };
  assert.equal(forecast(today, T).plan, null);
  assert.match(readinessText(forecast(today, T)), /last quick review/);
  const solid = { examDate: "2026-11-25", cards: many(10, () => ({ status: "known", srs: { box: 5, due: "2026-12-20", last: "2026-11-20" } })) };
  assert.match(readinessText(forecast(solid, T)), /keeps it there/);
});

test("readinessText reads naturally", () => {
  assert.equal(
    readinessText({ now: 0.42, ifNothing: 0.3, days: 4, plan: { perDay: 15, minutes: 3, reaches: 0.92 } }),
    "You're about 42% ready. 15 cards a day (about 3 min) until the test should get you to about 92%.",
  );
  assert.equal(
    readinessText({ now: 0.1, ifNothing: 0.05, days: 1, plan: { perDay: 60, minutes: 12, reaches: 0.5 } }),
    "You're about 10% ready. 60 cards a day (about 12 min) gets you to about 50%. Start today: there's a lot to cover.",
  );
});
