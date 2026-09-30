// Steps practice for decks whose cards are in order (procedures, timelines).
// Long decks are practiced a window of consecutive steps at a time.

export const WINDOW = 8;

// A run of up to `size` consecutive cards, starting at a random step.
export function pickWindow(cards, size = WINDOW, rand = Math.random) {
  if (cards.length <= size) return { start: 0, cards: [...cards] };
  const start = Math.floor(rand() * (cards.length - size + 1));
  return { start, cards: cards.slice(start, start + size) };
}

// Which of the placed cards are in the right position.
export function scoreOrder(placedIds, correctIds) {
  const marks = placedIds.map((id, i) => id === correctIds[i]);
  return { marks, correct: marks.filter(Boolean).length, total: correctIds.length };
}
