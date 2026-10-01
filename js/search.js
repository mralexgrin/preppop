// Search across every deck's cards, ignoring capitals and accents.

import { stripAccents } from "./answer.js";

const fold = (s) => stripAccents(String(s ?? "").toLowerCase()).replace(/\s+/g, " ").trim();

// Returns [{ deck, card }], term matches first, at most `limit`.
export function searchCards(decks, query, limit = 50) {
  const q = fold(query);
  if (!q) return [];
  const hits = [];
  for (const deck of decks) {
    for (const card of deck.cards) {
      const inTerm = fold(card.term).includes(q);
      if (inTerm || fold(card.definition).includes(q) || fold(card.hint).includes(q)) hits.push({ deck, card, rank: inTerm ? 0 : 1 });
    }
  }
  return hits.sort((a, b) => a.rank - b.rank).slice(0, limit).map(({ deck, card }) => ({ deck, card }));
}
