// Mix-ups: pairs of cards she keeps confusing (hyper/hypo, ser/estar). A
// mix-up is noted when a wrong answer is another card's answer in the same
// deck. card.mixups = { otherCardId: count }; telling the two apart in the
// mix-up drill counts it back down. Pure, so it's testable.

import { esc, normalize, shuffle } from "./util.js";
import { checkAnswer, countsAsCorrect } from "./answer.js";

export const MAX_COUNT = 9;

// The other card in the deck whose `side` matches the wrong answer, if any.
// typed: true for typed answers (graded leniently), false for picked options.
// Cards that show the same prompt (two "banco" cards: bank, bench) are
// skipped: picking the other one's answer there isn't a mix-up, the question
// was ambiguous.
export function findMixup(deck, card, side, wrong, { typed = false } = {}) {
  if (!String(wrong ?? "").trim()) return null;
  const prompt = side === "term" ? "definition" : "term";
  const own = normalize(card[side]);
  const ownPrompt = normalize(card[prompt]);
  return (
    deck.cards.find((other) => {
      if (other === card || other.id === card.id || normalize(other[side]) === own || normalize(other[prompt]) === ownPrompt) return false;
      return typed ? countsAsCorrect(checkAnswer(wrong, other[side]).verdict) : normalize(other[side]) === normalize(wrong);
    }) ?? null
  );
}

// What to say when her answer belonged to another card. answerSide: the side
// she was answering with ("term" or "definition"). Returns HTML.
export function mixupMessage(other, answerSide) {
  if (answerSide === "definition") return `That's the definition of <strong>${esc(other.term)}</strong>.`;
  const meaning = other.definition.length > 90 ? `${other.definition.slice(0, 87).trimEnd()}…` : other.definition;
  return `<strong>${esc(other.term)}</strong> is a different card: ${esc(meaning)}`;
}

// Own keys only: a card id like "constructor" mustn't read Object.prototype.
const countOf = (card, otherId) => (card.mixups && Object.hasOwn(card.mixups, otherId) ? card.mixups[otherId] : 0);

export function noteMixup(card, other) {
  card.mixups = { ...(card.mixups ?? {}), [other.id]: Math.min(MAX_COUNT, countOf(card, other.id) + 1) };
}

// One step closer to sorted out. Removes the pair at zero.
export function easeMixup(card, otherId) {
  if (!countOf(card, otherId)) return;
  const n = countOf(card, otherId) - 1;
  if (n > 0) card.mixups = { ...card.mixups, [otherId]: n };
  else {
    const { [otherId]: _, ...rest } = card.mixups;
    if (Object.keys(rest).length) card.mixups = rest;
    else delete card.mixups;
  }
}

// Each confused pair once, both directions added up, most confused first.
// Only pairs the drill can ask about: different terms and different definitions.
export function mixupPairs(decks) {
  const pairs = new Map();
  for (const deck of decks) {
    const byId = new Map(deck.cards.map((c) => [c.id, c]));
    for (const card of deck.cards) {
      for (const [otherId, n] of Object.entries(card.mixups ?? {})) {
        const other = byId.get(otherId);
        if (!other || other === card || !Object.hasOwn(card.mixups, otherId)) continue;
        if (normalize(other.term) === normalize(card.term) || normalize(other.definition) === normalize(card.definition)) continue;
        const key = `${deck.id}:${[card.id, otherId].sort().join("|")}`;
        const pair = pairs.get(key) ?? { key, deck, a: card, b: other, count: 0 };
        pair.count += n;
        pairs.set(key, pair);
      }
    }
  }
  return [...pairs.values()].sort((x, y) => y.count - x.count);
}

// She told the pair apart: one step down, from this card's side first.
// (Easing the other card's side doesn't touch its srs.last, so sync can
// occasionally bring that count back. Rare and harmless.)
export function easePair(card, other) {
  if (countOf(card, other.id)) easeMixup(card, other.id);
  else if (countOf(other, card.id)) easeMixup(other, card.id);
}

// The card this one is most often confused with (either direction).
export function partnerOf(deck, card) {
  let best = null;
  let bestN = 0;
  for (const other of deck.cards) {
    if (other === card) continue;
    const n = countOf(card, other.id) + countOf(other, card.id);
    if (n > bestN) {
      best = other;
      bestN = n;
    }
  }
  return best;
}

// Two questions per pair: see one card's definition, pick its term from the
// two confusable terms. Then the same for the other card.
export function pairDrill(pairs, rand = Math.random) {
  const questions = pairs.filter(({ a, b }) => normalize(a.term) !== normalize(b.term)).flatMap(({ deck, a, b }) => [
    { deck, card: a, other: b, options: rand() < 0.5 ? [a.term, b.term] : [b.term, a.term] },
    { deck, card: b, other: a, options: rand() < 0.5 ? [a.term, b.term] : [b.term, a.term] },
  ]);
  return shuffle(questions);
}
