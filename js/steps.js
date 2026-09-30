// Steps practice for decks whose cards are in order (procedures, timelines).
// Long decks are practiced a window of consecutive steps at a time.

export const WINDOW = 8;

// A run of up to `size` consecutive cards, starting at a random step.
export function pickWindow(cards, size = WINDOW, rand = Math.random) {
  if (cards.length <= size) return { start: 0, cards: [...cards] };
  const start = Math.floor(rand() * (cards.length - size + 1));
  return { start, cards: cards.slice(start, start + size) };
}

// Which of the placed steps are in the right position. Compared by what the
// student sees (the step text), so two identical steps are interchangeable.
export function scoreOrder(placed, correct) {
  const marks = placed.map((step, i) => step === correct[i]);
  return { marks, correct: marks.filter(Boolean).length, total: correct.length };
}
