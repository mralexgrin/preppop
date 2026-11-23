// Word Builder: medical words made from the parts in the "Medical
// terminology" starter deck, so she can work out words she's never seen.
// Each part matches a card's term in that deck exactly, so practicing a word
// also practices those cards. Spanish medical words use the same Greek and
// Latin parts, so each word lists its Spanish form too.
// Content note: standard medical-terminology textbook definitions. Flagged
// for human review in docs/AUTONOMY_LOG.md.

import { STARTERS } from "./starters.js";

export const STARTER_ID = "med-terms";

// The Words tab shows on her copy of the Medical terminology starter deck.
export const hasWordBuilder = (deck) => deck?.starter === STARTER_ID;

// [word, parts (card terms in the starter deck), plain meaning, Spanish,
//  alsoTrue: words whose meaning is also right for this one, never offered as wrong choices]
const W = (word, parts, meaning, es, alsoTrue = []) => ({ word, parts, meaning, es, alsoTrue });
export const WORDS = [
  W("tachycardia", ["tachy-", "cardi/o"], "fast heart rate", "taquicardia"),
  W("bradycardia", ["brady-", "cardi/o"], "slow heart rate", "bradicardia"),
  W("tachypnea", ["tachy-", "-pnea"], "fast breathing", "taquipnea"),
  W("bradypnea", ["brady-", "-pnea"], "slow breathing", "bradipnea"),
  W("apnea", ["a- / an-", "-pnea"], "not breathing", "apnea"),
  W("dyspnea", ["dys-", "-pnea"], "difficult or labored breathing", "disnea"),
  W("hepatitis", ["hepat/o", "-itis"], "inflammation of the liver", "hepatitis"),
  W("gastritis", ["gastr/o", "-itis"], "inflammation of the stomach", "gastritis"),
  W("nephritis", ["nephr/o", "-itis"], "inflammation of the kidney", "nefritis"),
  W("dermatitis", ["derm/o, dermat/o", "-itis"], "inflammation of the skin", "dermatitis"),
  W("neuritis", ["neur/o", "-itis"], "inflammation of a nerve", "neuritis"),
  W("pericarditis", ["peri-", "cardi/o", "-itis"], "inflammation of the sac around the heart", "pericarditis"),
  W("endocarditis", ["endo-", "cardi/o", "-itis"], "inflammation of the inner lining of the heart", "endocarditis"),
  W("neuralgia", ["neur/o", "-algia"], "nerve pain", "neuralgia"),
  W("gastralgia", ["gastr/o", "-algia"], "stomach pain", "gastralgia"),
  W("cardiomegaly", ["cardi/o", "-megaly"], "enlarged heart", "cardiomegalia"),
  W("hepatomegaly", ["hepat/o", "-megaly"], "enlarged liver", "hepatomegalia"),
  W("gastrectomy", ["gastr/o", "-ectomy"], "surgical removal of all or part of the stomach", "gastrectomía"),
  W("nephrectomy", ["nephr/o", "-ectomy"], "surgical removal of a kidney", "nefrectomía"),
  W("gastrotomy", ["gastr/o", "-otomy"], "surgical cut into the stomach", "gastrotomía"),
  W("osteotomy", ["oste/o", "-otomy"], "surgical cut into a bone", "osteotomía"),
  W("gastrostomy", ["gastr/o", "-ostomy"], "surgical opening into the stomach, for example for a feeding tube", "gastrostomía"),
  W("gastroscopy", ["gastr/o", "-scopy"], "looking inside the stomach with a scope", "gastroscopia", ["endoscopy"]), // a gastroscopy is an endoscopy
  W("endoscopy", ["endo-", "-scopy"], "looking inside the body with a scope", "endoscopia"),
  W("cardiology", ["cardi/o", "-ology"], "study of the heart", "cardiología"),
  W("dermatology", ["derm/o, dermat/o", "-ology"], "study of the skin", "dermatología"),
  W("neurology", ["neur/o", "-ology"], "study of the nerves and nervous system", "neurología"),
  W("nephrology", ["nephr/o", "-ology"], "study of the kidneys", "nefrología"),
  W("hepatology", ["hepat/o", "-ology"], "study of the liver", "hepatología"),
  W("hematology", ["hem/o, hemat/o", "-ology"], "study of the blood", "hematología"),
  W("osteology", ["oste/o", "-ology"], "study of bones", "osteología"),
  W("erythrocyte", ["erythr/o", "-cyte"], "red blood cell", "eritrocito"),
  W("leukocyte", ["leuk/o", "-cyte"], "white blood cell", "leucocito"),
  W("osteocyte", ["oste/o", "-cyte"], "bone cell", "osteocito"),
  W("anemia", ["a- / an-", "-emia"], "too few healthy red blood cells (literally \"without blood\")", "anemia"),
  W("leukemia", ["leuk/o", "-emia"], "cancer of the white blood cells (literally \"white blood\")", "leucemia"),
  W("hyperemia", ["hyper-", "-emia"], "too much blood in one part of the body, like a flushed area", "hiperemia"),
  W("hypodermic", ["hypo-", "derm/o, dermat/o"], "under the skin, like a hypodermic needle", "hipodérmico"),
  W("cardiopulmonary", ["cardi/o", "pulmon/o"], "heart and lungs, as in CPR (cardiopulmonary resuscitation)", "cardiopulmonar"),
];

// The starter deck's cards for a word's parts (only the ones she still has).
export function partCards(deck, word) {
  if (!deck) return [];
  return word.parts.map((part) => deck.cards.find((c) => c.term === part)).filter(Boolean);
}

// Words she can practice with this deck: every part still a card in it
// (she may have deleted or renamed some).
export const usableWords = (deck, words = WORDS) => words.filter((w) => partCards(deck, w).length === w.parts.length);

const starterMeanings = new Map((STARTERS.find((s) => s.id === STARTER_ID)?.cards ?? []).map((c) => [c.term, c.definition]));
export const meaningOf = (deck, part) => deck?.cards.find((c) => c.term === part)?.definition ?? starterMeanings.get(part) ?? "";

// How much each part of a word was practiced: true (right), false (missed),
// or null (leave that card alone).
// Decode: the parts the chosen meaning's word shares with this one are right,
// the others missed ("slow breathing" for tachypnea: -pnea right, tachy-
// missed). A choice sharing no part says nothing about any one part.
// Build: a part she placed at all is right; order only affects the word's score.
export function partGrades(word, kind, value, words = WORDS) {
  if (kind === "build") return word.parts.map((p) => value.includes(p));
  if (value === word.meaning) return word.parts.map(() => true);
  const chosen = words.find((x) => x.meaning === value);
  if (!chosen || !chosen.parts.some((p) => word.parts.includes(p))) return word.parts.map(() => null);
  return word.parts.map((p) => chosen.parts.includes(p));
}

// Decode: see the word, pick its meaning. Wrong choices share a part with it
// where possible ("tachycardia" vs "tachypnea" vs "bradycardia"), so the parts
// decide the answer.
export function decodeQuestion(word, words = WORDS, rand = Math.random) {
  const others = words.filter((w) => w !== word && !word.alsoTrue.includes(w.word) && !w.alsoTrue.includes(word.word));
  const sharing = shuffleWith(others.filter((w) => w.parts.some((p) => word.parts.includes(p))), rand);
  const rest = shuffleWith(others.filter((w) => !sharing.includes(w)), rand);
  const wrong = [...sharing, ...rest].slice(0, 3).map((w) => w.meaning);
  return { kind: "decode", word, options: shuffleWith([word.meaning, ...wrong], rand) };
}

// Build: see the meaning, tap its parts in order from a tray that also holds
// look-alike parts (other prefixes for a prefix, other organs for a root...).
export function buildQuestion(word, words = WORDS, rand = Math.random, traySize = 6) {
  const all = [...new Set(words.flatMap((w) => w.parts))].filter((p) => !word.parts.includes(p));
  const kind = (p) => (p.endsWith("-") ? "prefix" : p.startsWith("-") ? "suffix" : "root");
  const kinds = new Set(word.parts.map(kind));
  const alike = shuffleWith(all.filter((p) => kinds.has(kind(p))), rand);
  const other = shuffleWith(all.filter((p) => !kinds.has(kind(p))), rand);
  const extra = [...alike, ...other].slice(0, Math.max(0, traySize - word.parts.length));
  return { kind: "build", word, tray: shuffleWith([...word.parts, ...extra], rand) };
}

export const checkBuild = (picked, word) => picked.length === word.parts.length && picked.every((p, i) => p === word.parts[i]);

// A round: half decode, half build, least-practiced words first. seenCount
// should be per word (e.g. the average of its part cards), so 3-part words
// and words with common parts aren't pushed to the back.
// pool: the words she can practice; distractors still come from all words.
export function makeRound(pool = WORDS, size = 10, seenCount = () => 0, rand = Math.random, words = WORDS) {
  const picked = shuffleWith(pool, rand)
    .sort((a, b) => seenCount(a) - seenCount(b))
    .slice(0, Math.min(size, pool.length));
  const offset = rand() < 0.5 ? 0 : 1;
  return picked.map((w, i) => ((i + offset) % 2 ? buildQuestion(w, words, rand) : decodeQuestion(w, words, rand)));
}

function shuffleWith(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
