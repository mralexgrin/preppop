// PrepPop answer service: a Cloudflare Worker that holds the Anthropic key and
// does exactly one job, writing wrong answer choices for Test mode. The prompt,
// model, and limits live here so the public endpoint can't be used as a
// general-purpose Claude proxy.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5-5";
const MAX_ITEMS = 30;
const MAX_TEXT = 600;
const MAX_NAME = 120;
const MAX_BODY_BYTES = 64 * 1024;

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

class BadRequest extends Error {}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") ?? "";
    const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim());
    if (!allowed.includes(origin)) return Response.json({ error: "origin_not_allowed" }, { status: 403 });

    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
    const reply = (body, status = 200) => Response.json(body, { status, headers: cors });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST" || new URL(request.url).pathname !== "/wrong-answers") {
      return reply({ error: "not_found" }, 404);
    }

    if (env.LIMITER) {
      const { success } = await env.LIMITER.limit({ key: request.headers.get("CF-Connecting-IP") ?? "unknown" });
      if (!success) return reply({ error: "rate_limited" }, 429);
    }

    let input;
    try {
      input = await readInput(request);
    } catch (err) {
      if (err instanceof BadRequest) return reply({ error: "bad_request", detail: err.message }, 400);
      throw err;
    }

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    try {
      const response = await client.beta.messages.create(buildRequest(input.deckName, input.items));
      return reply({ answers: readResponse(response, input.items) });
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) return reply({ error: "busy" }, 429);
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
        console.error("Anthropic key problem", err.status);
        return reply({ error: "misconfigured" }, 502);
      }
      if (err instanceof Anthropic.APIError) {
        console.error("Anthropic API error", err.status, err.message);
        return reply({ error: "upstream" }, 502);
      }
      console.error("Answer generation failed", err);
      return reply({ error: "upstream" }, 502);
    }
  },
};

async function readInput(request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) throw new BadRequest("body too large");
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new BadRequest("body too large");

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new BadRequest("body must be JSON");
  }

  const str = (v, max, field) => {
    if (typeof v !== "string" || !v.trim()) throw new BadRequest(`${field} must be a non-empty string`);
    return v.trim().slice(0, max);
  };
  if (!Array.isArray(body?.items) || body.items.length === 0 || body.items.length > MAX_ITEMS) {
    throw new BadRequest(`items must be an array of 1-${MAX_ITEMS}`);
  }
  return {
    deckName: str(body.deckName, MAX_NAME, "deckName"),
    items: body.items.map((item) => ({
      key: str(item?.key, 64, "key"),
      shows: item?.shows === "definition" ? "definition" : "term",
      prompt: str(item?.prompt, MAX_TEXT, "prompt"),
      answer: str(item?.answer, MAX_TEXT, "answer"),
    })),
  };
}

function buildRequest(deckName, items) {
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

const normalize = (s) => String(s).trim().toLowerCase().replace(/\s+/g, " ");

// Returns { [key]: string[] } with up to 3 cleaned wrong answers per item.
function readResponse(response, items) {
  if (response.stop_reason === "refusal") throw new Error("model declined the request");
  if (response.stop_reason === "max_tokens") throw new Error("response was cut off");
  const text = response.content.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("response was empty");

  const answers = new Map(items.map((item) => [item.key, normalize(item.answer)]));
  const out = {};
  for (const { key, wrong } of JSON.parse(text).items) {
    if (!answers.has(key)) continue;
    const seen = new Set([answers.get(key)]);
    out[key] = wrong
      .map((w) => String(w).trim().slice(0, MAX_TEXT))
      .filter((w) => w && !seen.has(normalize(w)) && seen.add(normalize(w)))
      .slice(0, 3);
  }
  return out;
}
