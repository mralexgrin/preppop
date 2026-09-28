// Claude writes the wrong answer choices for Test mode.
// The API key is the user's own (saved in their browser), so the SDK runs client-side.

export const MODEL = "claude-opus-5-5";
export const MODEL_LABEL = "Claude Opus 5.5";

const SDK_URL = "https://esm.sh/@anthropic-ai/sdk";
const BATCH_SIZE = 30;

const SYSTEM = `You write the wrong answer choices for multiple-choice flashcard quizzes.

For each item you get what the student is shown (a term or a definition) and the correct answer. Write exactly 3 wrong answers that:
- are clearly incorrect for that prompt: never a synonym, paraphrase, or partly correct version of the right answer
- are plausible to someone still learning the material: same topic, same kind of thing, the mix-ups a real student makes
- match the correct answer's length, format, tone, and capitalization, so style never gives the answer away
- are different from each other

When the student is shown a term, answers are definitions. When shown a definition, answers are terms.
Return one entry per item and copy its key exactly.`;

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          wrong: { type: "array", items: { type: "string" } },
        },
        required: ["key", "wrong"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

// items: [{ key, shows: "term" | "definition", prompt, answer }]
export function buildRequest(deckName, items) {
  return {
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          deck: deckName,
          items: items.map(({ key, shows, prompt, answer }) => ({
            key,
            student_is_shown: shows,
            prompt,
            correct_answer: answer,
          })),
        }),
      },
    ],
  };
}

// Returns { [key]: string[] } with up to 3 cleaned wrong answers per item.
export function readResponse(response, items) {
  if (response.stop_reason === "refusal") throw new Error("Claude declined this request");
  if (response.stop_reason === "max_tokens") throw new Error("the response was cut off");
  const text = response.content.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("the response was empty");

  const answers = new Map(items.map((item) => [item.key, normalize(item.answer)]));
  const out = {};
  for (const { key, wrong } of JSON.parse(text).items) {
    if (!answers.has(key)) continue;
    const seen = new Set([answers.get(key)]);
    out[key] = wrong
      .map((w) => String(w).trim())
      .filter((w) => w && !seen.has(normalize(w)) && seen.add(normalize(w)))
      .slice(0, 3);
  }
  return out;
}

export const normalize = (s) => String(s).trim().toLowerCase().replace(/\s+/g, " ");

let sdk;
async function loadSdk() {
  sdk ??= import(SDK_URL).then((mod) => mod.default);
  return sdk;
}

export async function writeWrongAnswers({ apiKey, deckName, items }) {
  let Anthropic;
  try {
    Anthropic = await loadSdk();
  } catch {
    sdk = undefined;
    throw new Error("couldn't load the Claude SDK");
  }
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const batches = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) batches.push(items.slice(i, i + BATCH_SIZE));

  try {
    const results = await Promise.all(
      batches.map(async (batch) =>
        readResponse(await client.beta.messages.create(buildRequest(deckName, batch)), batch),
      ),
    );
    return Object.assign({}, ...results);
  } catch (err) {
    throw new Error(friendlyError(err, Anthropic));
  }
}

function friendlyError(err, Anthropic) {
  if (err instanceof Anthropic.AuthenticationError) return "your API key was rejected";
  if (err instanceof Anthropic.PermissionDeniedError) return "your API key doesn't have access to this model";
  if (err instanceof Anthropic.RateLimitError) return "you've hit your API rate limit, try again shortly";
  if (err instanceof Anthropic.APIConnectionError) return "couldn't reach the Claude API";
  if (err instanceof Anthropic.APIError) return `the Claude API returned an error (${err.status ?? "unknown"})`;
  return err?.message || "something went wrong";
}
