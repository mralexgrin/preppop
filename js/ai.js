// AI features go through the PrepPop answer service, a Cloudflare Worker (see
// worker/) that holds the Anthropic key and calls Claude: wrong answers for
// Test mode, flashcards made from class notes, and card explanations.

export const MODEL_LABEL = "Claude Opus 5.5";

export const SERVICE_URL = "https://preppop-ai.REPLACE_ME.workers.dev";
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
  const results = await Promise.all(batches.map((batch) => request("/wrong-answers", { deckName, items: batch })));
  return Object.assign({}, ...results.map((r) => r.answers ?? {}));
}

// Returns [{ term, definition }] suggested from pasted class notes.
export async function makeCardsFromNotes({ notes, subject, deckName }) {
  const { cards } = await request("/cards-from-notes", { notes: notes.slice(0, MAX_NOTES), subject, deckName });
  return Array.isArray(cards) ? cards.filter((c) => typeof c?.term === "string" && typeof c?.definition === "string") : [];
}

// Returns { explanation, example, memoryTrick, cardIssue }.
export async function explainCard({ term, definition, subject }) {
  const x = await request("/explain", { term, definition, subject });
  if (typeof x?.explanation !== "string" || !x.explanation) throw new Error("the AI service had a problem");
  const text = (v) => (typeof v === "string" ? v : "");
  return { explanation: x.explanation, example: text(x.example), memoryTrick: text(x.memoryTrick), cardIssue: text(x.cardIssue) };
}

async function request(path, body) {
  if (globalThis.navigator?.onLine === false) throw new Error("you're offline");
  let res;
  try {
    res = await fetch(`${SERVICE_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("couldn't reach the AI service");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(ERRORS[data.error] ?? "the AI service had a problem");
  return data;
}
