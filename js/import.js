// Turns a pasted list ("one card per line") into term/definition pairs.
// Works with Quizlet exports (tab-separated) and hand-typed lists like
// "mitochondria - makes energy" or "1. hola: hello".

export const SEPARATORS = {
  tab: { label: "Tab", find: /\t/ },
  dash: { label: "Dash ( - )", find: /\s+[-–—]\s+/ },
  colon: { label: "Colon ( : )", find: /\s*:\s+|\s*:(?=\S)/ },
  equals: { label: "Equals ( = )", find: /\s*=\s*/ },
  comma: { label: "Comma ( , )", find: /\s*,\s*/ },
};

const BULLET = /^\s*(?:[-*•·]|\d{1,3}[.)])\s+/;

// Picks the first separator (in priority order) that splits most lines.
export function detectSeparator(lines) {
  for (const [name, { find }] of Object.entries(SEPARATORS)) {
    const hits = lines.filter((line) => find.test(line)).length;
    if (hits && hits >= Math.ceil(lines.length * 0.6)) return name;
  }
  return null;
}

export function parseList(text, { sep = "auto", swap = false } = {}) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.replace(BULLET, "").trim())
    .filter(Boolean);
  const chosen = sep === "auto" ? detectSeparator(lines) : sep;
  const cards = [];
  const skipped = [];
  if (!chosen) return { cards, skipped: lines, sep: null };

  const { find } = SEPARATORS[chosen];
  for (const line of lines) {
    const match = line.match(find);
    if (!match) {
      skipped.push(line);
      continue;
    }
    const left = line.slice(0, match.index).trim();
    const right = line.slice(match.index + match[0].length).trim();
    if (!left || !right) {
      skipped.push(line);
      continue;
    }
    cards.push(swap ? { term: right, definition: left } : { term: left, definition: right });
  }
  return { cards, skipped, sep: chosen };
}
