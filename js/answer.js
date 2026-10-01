// Checks a typed answer against the expected one, the way a fair teacher would:
// ignores capitals, punctuation, and extra spaces; accepts any of several
// answers written "a / b" or "a; b"; treats "(to) eat" as optional words;
// ignores a leading article or "to"; notices a missing accent without failing
// it; and calls small typos "almost" so the student can decide.

const STRIP_PUNCT = /[.,!?¡¿;:"“”'’`()[\]{}]/g;
const LEADING = /^(?:to|the|a|an|el|la|los|las|un|una|unos|unas|le|les|der|die|das)\s+/;

const squash = (s) => s.toLowerCase().replace(STRIP_PUNCT, " ").replace(/\s+/g, " ").trim();
export const stripAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

// Every acceptable spelling of the expected answer, in canonical form.
export function acceptedForms(expected) {
  const alternatives = String(expected)
    .split(/\s*[/;]\s*|\s+or\s+/i)
    .filter((s) => s.trim());
  const forms = new Set();
  for (const alt of alternatives) {
    const withParens = squash(alt.replace(/[()]/g, ""));
    const withoutParens = squash(alt.replace(/\([^)]*\)/g, " "));
    for (const f of [withParens, withoutParens]) {
      if (!f) continue;
      forms.add(f);
      forms.add(f.replace(LEADING, ""));
    }
  }
  forms.add(squash(String(expected)));
  return [...forms].filter(Boolean);
}

export function editDistance(a, b) {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

// verdict: "correct" | "accent" (right apart from accents) | "almost" (small typo) | "wrong" | "empty"
export function checkAnswer(input, expected) {
  const typed = squash(String(input ?? ""));
  if (!typed) return { verdict: "empty" };
  const bare = typed.replace(LEADING, "");
  const forms = acceptedForms(expected);

  if (forms.includes(typed) || forms.includes(bare)) return { verdict: "correct" };

  const plainForms = forms.map(stripAccents);
  if (plainForms.includes(stripAccents(typed)) || plainForms.includes(stripAccents(bare))) return { verdict: "accent" };

  const allowed = (len) => (len <= 3 ? 0 : len <= 7 ? 1 : 2);
  const close = plainForms.some((f) => {
    const d = Math.min(editDistance(stripAccents(typed), f), editDistance(stripAccents(bare), f));
    return d <= allowed(f.length);
  });
  return { verdict: close ? "almost" : "wrong" };
}

export const countsAsCorrect = (verdict) => verdict === "correct" || verdict === "accent";

// Whether to offer the accent keys (á é í ó ú ñ ...) for this answer.
export const needsAccentKeys = (expected, subject) => subject === "spanish" || /[^\u0000-\u007f]/.test(expected);
export const ACCENT_KEYS = ["á", "é", "í", "ó", "ú", "ü", "ñ", "¿", "¡"];
