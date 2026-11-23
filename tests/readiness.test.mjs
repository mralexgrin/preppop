import { test } from "node:test";
import assert from "node:assert/strict";
import { recallOn, readinessOn, simulate, forecast, readinessText, pct, GOAL, DAILY_OPTIONS } from "../js/readiness.js";
import { grade, addDays } from "../js/srs.js";

const T = "2026-11-23";
const many = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const fresh = (n) => many(n, () => ({ status: "new" }));

test("recall: unpracticed cards count as not known; known cards fade over their interval", () => {
  assert.equal(recallOn({ status: "new" }, T), 0);
  const known = { status: "known", srs: { box: 3, due: "2026-11-30", last: T } }; // 7-day box
  assert.equal(recallOn(known, T), 1);
  assert.ok(Math.abs(recallOn(known, "2026-11-30", T) - 0.9) < 1e-9, "about 90% when it's due");
  assert.ok(recallOn(known, "2026-12-20", T) < 0.8, "fades well past due");
});

test("missing a card counts as barely known, below a lucky guess", () => {
  const missed = { status: "new", ...grade({ status: "new" }, false, T) };
  const guessed = { status: "new", ...grade({ status: "new" }, true, T, null, { guessed: true }) };
  assert.ok(recallOn(missed, T) <= 0.2 + 1e-9);
  assert.ok(recallOn(guessed, T) > recallOn(missed, T));
});

test("getting every card of a new deck wrong doesn't make it look ready", () => {
  const deck = { examDate: addDays(T, 7), cards: fresh(40).map((c) => ({ ...c, ...grade(c, false, T) })) };
  const f = forecast(deck, T);
  assert.ok(pct(f.now) <= 20, `now ${pct(f.now)}%`);
});

test("older cards with a schedule but no 'last practiced' date still count", () => {
  // seedSchedule gives old known cards { box: 1, due: tomorrow } with no last.
  const seeded = { status: "known", srs: { box: 1, due: addDays(T, 1) } };
  assert.equal(recallOn(seeded, T), 1, "last practiced is worked out as today");
  const imported = { status: "known", srs: { box: 3, due: addDays(T, 2) } }; // last ≈ 5 days ago
  assert.ok(recallOn(imported, T) > 0.9 && recallOn(imported, T) < 1);
});

test("odd mixes from older data don't break: known in box 0, learning in a high box, new with a schedule", () => {
  for (const card of [
    { status: "known", srs: { box: 0, due: T, last: T } },
    { status: "learning", srs: { box: 4, due: addDays(T, 1), last: T } },
    { status: "new", srs: { box: 2, due: addDays(T, 3), last: T } },
  ]) {
    const r = recallOn(card, T);
    assert.ok(Number.isFinite(r) && r >= 0 && r <= 1, JSON.stringify(card));
  }
});

test("readiness is the average recall, 0 for an empty deck", () => {
  const cards = [{ status: "new" }, { status: "known", srs: { box: 3, due: "2026-11-30", last: T } }];
  assert.equal(readinessOn(cards, T), 0.5);
  assert.equal(readinessOn([], T), 0);
});

test("practicing more each day predicts a better test day, and never past what's possible", () => {
  const cards = fresh(30);
  const little = simulate(cards, T, "2026-11-30", 5);
  const lots = simulate(cards, T, "2026-11-30", 20);
  assert.ok(lots > little);
  assert.ok(lots <= 1 && little >= 0);
  assert.deepEqual(cards[0], { status: "new" }, "doesn't change her real cards");
});

test("forecast finds the smallest daily amount that reaches the goal", () => {
  const deck = { examDate: "2026-11-30", cards: fresh(30) };
  const f = forecast(deck, T);
  assert.equal(f.days, 7);
  assert.ok(pct(f.plan.reaches) >= pct(GOAL));
  const i = DAILY_OPTIONS.indexOf(f.plan.perDay);
  if (i > 0) assert.ok(pct(simulate(deck.cards, T, deck.examDate, DAILY_OPTIONS[i - 1])) < pct(GOAL), "the option before wouldn't have reached it");
  assert.equal(f.plan.minutes, Math.max(1, Math.round((f.plan.perDay * 12) / 60)));
  assert.match(readinessText(f), /cards a day from this deck .* until the test should get you to about \d+%\.$/);
});

test("test today, tomorrow, or past: practical advice, no plan", () => {
  const deck = (examDate, cards) => ({ examDate, cards });
  assert.match(readinessText(forecast(deck(T, fresh(5)), T)), /last quick review/);
  const tomorrow = forecast(deck(addDays(T, 1), fresh(8)), T);
  assert.equal(tomorrow.plan, null);
  assert.equal(readinessText(tomorrow), "You're about 0% ready. Tonight, go through all 8 cards until you know each one, then take a quick look in the morning.");
  const solid = many(5, () => ({ status: "known", srs: { box: 5, due: addDays(T, 20), last: T } }));
  assert.match(readinessText(forecast(deck(T, solid), T)), /quick look this morning/);
  assert.match(readinessText(forecast(deck(addDays(T, -2), fresh(3)), T)), /last quick review/);
});

test("ready now but fading: says it fades instead of sounding like practice lowers the score", () => {
  const cards = many(20, () => ({ status: "known", srs: { box: 1, due: addDays(T, 1), last: T } }));
  const f = forecast({ examDate: addDays(T, 10), cards }, T);
  assert.equal(pct(f.now), 100);
  assert.match(readinessText(f), /^You're about 100% ready now, but it fades without review: .* keeps you around \d+%\.$/);
});

test("a deck she'll keep without practice gets the light-touch message, and no simulation", () => {
  const cards = many(10, () => ({ status: "known", srs: { box: 5, due: "2026-12-20", last: "2026-11-20" } }));
  const f = forecast({ examDate: "2026-11-25", cards }, T);
  assert.equal(f.plan, null);
  assert.match(readinessText(f), /keeps it there/);
});

test("small decks say 'the whole deck', and only big ones say there's a lot to cover", () => {
  const small = forecast({ examDate: addDays(T, 2), cards: fresh(4) }, T);
  assert.equal(small.plan.wholeDeck, true);
  assert.doesNotMatch(readinessText(small), /a lot to cover/);
  assert.match(readinessText(small), /whole deck each day/);
  const big = forecast({ examDate: addDays(T, 2), cards: fresh(300) }, T);
  assert.match(readinessText(big), /a lot to cover/);
});

test("rounding is consistent: 89.4% falls short, 89.7% counts as 90%", () => {
  const f = (reaches) => readinessText({ now: 0.3, ifNothing: 0.2, days: 5, size: 100, plan: { perDay: 60, minutes: 12, reaches, wholeDeck: false } });
  assert.match(f(0.894), /gets you to about 89%\. There's a lot to cover/);
  assert.match(f(0.897), /should get you to about 90%\.$/);
});

test("fast enough for a big deck", () => {
  const deck = { examDate: addDays(T, 30), cards: fresh(500) };
  const start = performance.now();
  forecast(deck, T);
  const ms = performance.now() - start;
  assert.ok(ms < 400, `${Math.round(ms)} ms`);
});
