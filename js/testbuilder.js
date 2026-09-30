// Builds practice tests: which cards, which question type each gets, and the
// wrong answers for multiple choice and true/false. Pure, so it's testable.

import { normalize, shuffle } from "./util.js";

export const TYPES = {
  choice: { label: "Multiple choice", needsWrong: true },
  written: { label: "Written", needsWrong: false },
  truefalse: { label: "True or false", needsWrong: true },
};

const other = (side) => (side === "term" ? "definition" : "term");

// mode: "term" (show term), "definition" (show definition), or "mix".
// types: non-empty list of TYPES keys, spread evenly over the questions.
export function buildQuestions(cards, { count, mode, types }, rand = Math.random) {
  const picked = shuffle(cards).slice(0, Math.max(1, Math.min(count, cards.length)));
  const typeCycle = shuffle(picked.map((_, i) => types[i % types.length]));
  return picked.map((card, i) => {
    const shows = mode === "mix" ? (rand() < 0.5 ? "term" : "definition") : mode;
    return { card, type: typeCycle[i], shows, prompt: card[shows], answer: card[other(shows)] };
  });
}

// Up to 3 wrong answers: Claude's first, then other cards' answers.
export function wrongAnswersFor(q, fromAi, deckCards) {
  const seen = new Set([normalize(q.answer)]);
  const out = [];
  const add = (a) => {
    const key = normalize(a);
    if (a && !seen.has(key) && out.length < 3) {
      seen.add(key);
      out.push(a);
    }
  };
  (fromAi ?? []).forEach(add);
  shuffle(deckCards).forEach((c) => add(c[other(q.shows)]));
  return out;
}

// True/false shows the real answer half the time, a wrong one otherwise.
export function makeTrueFalse(q, wrong, rand = Math.random) {
  if (!wrong.length || rand() < 0.5) return { statement: q.answer, isTrue: true };
  return { statement: wrong[Math.floor(rand() * wrong.length)], isTrue: false };
}
