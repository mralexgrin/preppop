// Word Builder: medical words made from the parts in the "Medical
// terminology" starter deck, so she can work out words she's never seen.
// Each part matches a card's term in that deck exactly, so practicing a word
// also practices those cards. Spanish medical words use the same Greek and
// Latin parts, so each word lists its Spanish form too.
// Content note: standard medical-terminology textbook definitions. Flagged
// for human review in docs/AUTONOMY_LOG.md.

import { shuffle } from "./util.js";

export const STARTER_ID = "med-terms";

// The Words tab shows on her copy of the Medical terminology starter deck.
export const hasWordBuilder = (deck) => deck?.starter === STARTER_ID;

// [word, parts (card terms in the starter deck), plain meaning, Spanish]
const W = (word, parts, meaning, es) => ({ word, parts, meaning, es });
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
  W("gastroscopy", ["gastr/o", "-scopy"], "looking inside the stomach with a scope", "gastroscopia"),
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

export const meaningOf = (deck, part) => deck?.cards.find((c) => c.term === part)?.definition ?? "";

// Decode: see the word, pick its meaning. Wrong choices share a part with it
// where possible ("tachycardia" vs "tachypnea" vs "bradycardia"), so the parts
// decide the answer.
export function decodeQuestion(word, words = WORDS, rand = Math.random) {
  const others = words.filter((w) => w !== word);
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

// A round: half decode, half build, words she's seen least first.
export function makeRound(words = WORDS, size = 10, seenCount = () => 0, rand = Math.random) {
  const picked = shuffleWith(words, rand)
    .sort((a, b) => seenCount(a) - seenCount(b))
    .slice(0, Math.min(size, words.length));
  return picked.map((w, i) => (i % 2 ? buildQuestion(w, words, rand) : decodeQuestion(w, words, rand)));
}

function shuffleWith(list, rand) {
  if (rand === Math.random) return shuffle(list);
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
