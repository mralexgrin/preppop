// AI features go through the PrepPop answer service, a Cloudflare Worker (see
// worker/) that holds the Anthropic key and calls Claude: wrong answers for
// Test mode, flashcards made from class notes, card explanations, and
// feedback on the learner's own explanations (Teach It Back), and Clinical Shift
// practice with a fictional patient.

import { currentLevel } from "./profiles.js";

export const MODEL_LABEL = "Claude Opus 5.5";
// Only the learner's school level is sent (currentLevel()), so answers fit
// their reading level; never their name.

export const SERVICE_URL = "https://preppop-ai.preppop-ai.workers.dev";
const BATCH_SIZE = 30;
export const MAX_NOTES = 12000;

const ERRORS = {
  rate_limited: "too many requests in a short time, wait a minute and try again",
  busy: "the AI service is busy right now",
  misconfigured: "the AI service isn't set up yet",
};

// items: [{ key, shows: "term" | "definition", prompt, answer }]
// Returns { [key]: string[] } with up to 3 wrong answers per item.
export async function writeWrongAnswers({ deckName, items }) {
  const batches = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) batches.push(items.slice(i, i + BATCH_SIZE));
  const results = await Promise.all(batches.map((batch) => request("/wrong-answers", { deckName, items: batch, level: currentLevel() })));
  return Object.assign({}, ...results.map((r) => r.answers ?? {}));
}

// Returns [{ term, definition }] suggested from pasted class notes.
export async function makeCardsFromNotes({ notes, subject, deckName }) {
  const { cards } = await request("/cards-from-notes", { notes: notes.slice(0, MAX_NOTES), subject, deckName, level: currentLevel() });
  return Array.isArray(cards) ? cards.filter((c) => typeof c?.term === "string" && typeof c?.definition === "string") : [];
}

// Returns { explanation, example, memoryTrick, cardIssue }.
export async function explainCard({ term, definition, subject }) {
  const x = await request("/explain", { term, definition, subject, level: currentLevel() });
  if (typeof x?.explanation !== "string" || !x.explanation) throw new Error("the AI service had a problem");
  const text = (v) => (typeof v === "string" ? v : "");
  return { explanation: x.explanation, example: text(x.example), memoryTrick: text(x.memoryTrick), cardIssue: text(x.cardIssue) };
}

export const MAX_EXPLANATION = 1500;
export const VERDICTS = ["got_it", "partly", "not_yet"];

// Feedback on the learner's own explanation of a card, or on their answer to a follow-up
// question (question). Returns { verdict, summary, correct, missing, wrong, followUp }.
// signal (optional): an AbortSignal to cancel it.
export async function teachBack({ term, definition, subject, explanation, question = "" }, { signal } = {}) {
  const x = await request("/teach-back", { term, definition, subject, explanation: explanation.slice(0, MAX_EXPLANATION), level: currentLevel(), ...(question ? { question } : {}) }, { signal });
  if (!VERDICTS.includes(x?.verdict)) throw new Error("the AI service had a problem");
  const text = (v) => (typeof v === "string" ? v : "");
  const list = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === "string" && s.trim()) : []);
  return { verdict: x.verdict, summary: text(x.summary), correct: list(x.correct), missing: list(x.missing), wrong: list(x.wrong), followUp: text(x.followUp) };
}

// Clinical Shift: the patient's next line ({ say, readings, crisis, sig }),
// or the debrief at the end. transcript: [{ from: "student" | "patient", text,
// readings?, sig? }]; patient lines carry the service's signature back.
export async function shiftTurn({ scenario, transcript }, { signal } = {}) {
  const x = await request("/shift", { scenario, action: "turn", transcript }, { signal });
  if (typeof x?.say !== "string" || !x.say || typeof x.sig !== "string") throw new Error("the AI service had a problem");
  const readings = Array.isArray(x.readings) ? x.readings.filter((r) => typeof r === "string") : [];
  return { say: x.say, readings, crisis: x.crisis === true, sig: x.sig };
}

export async function shiftDebrief({ scenario, transcript, report }, { signal } = {}) {
  const x = await request("/shift", { scenario, action: "debrief", transcript, report }, { signal });
  if (typeof x?.summary !== "string" || !x.summary) throw new Error("the AI service had a problem");
  const list = (v) => (Array.isArray(v) ? v.filter((t) => typeof t === "string" && t.trim()) : []);
  return { summary: x.summary, didWell: list(x.didWell), missed: list(x.missed), terms: list(x.terms), toReport: list(x.toReport), note: typeof x.note === "string" ? x.note : "", crisis: x.crisis === true };
}

// Requests give up after TIMEOUT_MS so a hung connection can't leave a spinner forever.
export const TIMEOUT_MS = 45000;

async function request(path, body, { signal } = {}) {
  if (globalThis.navigator?.onLine === false) throw new Error("you're offline");
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${SERVICE_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: signal && AbortSignal.any ? AbortSignal.any([signal, timeout]) : signal ?? timeout,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new Error(timeout.aborted ? "the AI service took too long" : "couldn't reach the AI service");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(ERRORS[data.error] ?? "the AI service had a problem");
  return data;
}
