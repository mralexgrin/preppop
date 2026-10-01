// The subjects a deck can belong to. Order here is the order in the library.
// `speech` is the language each side is read aloud in (used by pronunciation).

export const SUBJECTS = [
  { id: "biology", name: "Biology", speech: { term: "en-US", definition: "en-US" } },
  { id: "clinical", name: "Clinical skills", speech: { term: "en-US", definition: "en-US" } },
  { id: "spanish", name: "Spanish", speech: { term: "es-ES", definition: "en-US" } },
  { id: "history", name: "History", speech: { term: "en-US", definition: "en-US" } },
  { id: "english", name: "English", speech: { term: "en-US", definition: "en-US" } },
  { id: "geometry", name: "Geometry", speech: { term: "en-US", definition: "en-US" } },
  { id: "other", name: "Other", speech: { term: "en-US", definition: "en-US" } },
];

export const subjectOf = (deck) => SUBJECTS.find((s) => s.id === deck?.subject) ?? SUBJECTS.at(-1);
export const isSubject = (id) => SUBJECTS.some((s) => s.id === id);

// Guesses a subject from a deck name, e.g. "Spanish verbs" -> spanish.
const HINTS = [
  ["clinical", /\b(clinical|medical|med term|terminology|vital|anatomy|nurs|cna|patient|emt|first aid|cpr|phlebotomy|pharm)/i],
  ["biology", /\b(bio|cell|dna|rna|gene|genetic|ecolog|photosynth|evolution|organism|mitosis|meiosis|protein|enzyme)/i],
  ["spanish", /\b(spanish|español|espanol|verbos?|vocabulario)\b/i],
  ["history", /\b(history|histor|war|revolution|empire|ancient|dynasty|civil rights|constitution|wwi|wwii|colonial|treaty)/i],
  ["geometry", /\b(geometry|angle|triangle|theorem|proof|polygon|circle|area|volume|trig|math)/i],
  ["english", /\b(english|literature|grammar|poem|poetry|novel|vocab|shakespeare|essay|literary)/i],
];

export function guessSubject(name) {
  return HINTS.find(([, pattern]) => pattern.test(name))?.[0] ?? null;
}
