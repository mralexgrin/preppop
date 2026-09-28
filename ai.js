// Test mode's wrong answers come from the PrepPop answer service, a Cloudflare
// Worker (see worker/) that holds the Anthropic key and calls Claude.

export const MODEL_LABEL = "Claude Opus 5.5";

const SERVICE_URL = "https://preppop-ai.REPLACE_ME.workers.dev";
const BATCH_SIZE = 30;

const ERRORS = {
  rate_limited: "too many tests in a short time, wait a minute and try again",
  busy: "the answer service is busy right now",
  misconfigured: "the answer service isn't set up correctly",
};

export const normalize = (s) => String(s).trim().toLowerCase().replace(/\s+/g, " ");

// items: [{ key, shows: "term" | "definition", prompt, answer }]
// Returns { [key]: string[] } with up to 3 wrong answers per item.
export async function writeWrongAnswers({ deckName, items }) {
  const batches = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) batches.push(items.slice(i, i + BATCH_SIZE));
  const results = await Promise.all(batches.map((batch) => request(deckName, batch)));
  return Object.assign({}, ...results);
}

async function request(deckName, items) {
  let res;
  try {
    res = await fetch(`${SERVICE_URL}/wrong-answers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deckName, items }),
    });
  } catch {
    throw new Error("couldn't reach the answer service");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(ERRORS[data.error] ?? "the answer service had a problem");
  return data.answers ?? {};
}
