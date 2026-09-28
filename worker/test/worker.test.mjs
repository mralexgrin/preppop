// Offline tests: the Anthropic API is stubbed through globalThis.fetch.
import assert from "node:assert/strict";
import worker from "../src/index.js";

const ORIGIN = "https://mralexgrin.github.io";
const env = { ANTHROPIC_API_KEY: "test-key", ALLOWED_ORIGINS: `${ORIGIN},http://localhost:4190` };
const items = [
  { key: "a", shows: "term", prompt: "Mars", answer: "The red planet" },
  { key: "b", shows: "definition", prompt: "Distance light travels in a year", answer: "Light-year" },
];

let upstream;
let lastCall;
globalThis.fetch = async (url, init) => {
  lastCall = { url: String(url), headers: new Headers(init.headers), body: JSON.parse(init.body) };
  return upstream(lastCall);
};
const ok = (items) =>
  Response.json({
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    stop_reason: "end_turn",
    stop_details: null,
    content: [{ type: "text", text: JSON.stringify({ items }) }],
    usage: { input_tokens: 1, output_tokens: 1 },
  });
const apiError = (status, type) => Response.json({ type: "error", error: { type, message: type } }, { status });

const call = (body, { origin = ORIGIN, method = "POST", path = "/wrong-answers", extraEnv = {} } = {}) =>
  worker.fetch(
    new Request(`https://preppop-ai.example.workers.dev${path}`, {
      method,
      headers: { Origin: origin, "content-type": "application/json" },
      body: method === "POST" ? JSON.stringify(body) : undefined,
    }),
    { ...env, ...extraEnv },
  );

const tests = {
  async "rejects other origins"() {
    const res = await call({ deckName: "x", items }, { origin: "https://evil.example" });
    assert.equal(res.status, 403);
  },
  async "answers CORS preflight"() {
    const res = await call(null, { method: "OPTIONS" });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  },
  async "rejects bad input"() {
    assert.equal((await call({ deckName: "x", items: [] })).status, 400);
    assert.equal((await call({ deckName: "", items })).status, 400);
    assert.equal((await call({ deckName: "x", items: Array(31).fill(items[0]) })).status, 400);
    assert.equal((await call({ deckName: "x", items: [{ key: "a", prompt: "p" }] })).status, 400);
  },
  async "unknown path is 404"() {
    assert.equal((await call({ deckName: "x", items }, { path: "/v1/messages" })).status, 404);
  },
  async "writes and cleans wrong answers"() {
    upstream = () =>
      ok([
        { key: "a", wrong: ["The ringed planet", "the red  planet", "The icy planet", "The hot planet"] },
        { key: "b", wrong: ["Parsec", "Parsec", "Astronomical unit", "Light-second"] },
        { key: "zzz", wrong: ["ignored"] },
      ]);
    const res = await call({ deckName: "Space", items });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
    const { answers } = await res.json();
    assert.deepEqual(answers, {
      a: ["The ringed planet", "The icy planet", "The hot planet"],
      b: ["Parsec", "Astronomical unit", "Light-second"],
    });
    assert.match(lastCall.url, /api\.anthropic\.com\/v1\/messages/);
    assert.equal(lastCall.headers.get("x-api-key"), "test-key");
    assert.equal(lastCall.headers.get("anthropic-beta"), "server-side-fallback-2026-07-01");
    assert.equal(lastCall.body.model, "claude-opus-5-5");
    assert.equal(lastCall.body.fallbacks, "default");
    assert.equal(lastCall.body.output_config.format.type, "json_schema");
    assert.equal(JSON.parse(lastCall.body.messages[0].content).items.length, 2);
  },
  async "bad server key is a 502"() {
    upstream = () => apiError(401, "authentication_error");
    const res = await call({ deckName: "x", items });
    assert.equal(res.status, 502);
    assert.equal((await res.json()).error, "misconfigured");
  },
  async "upstream rate limit is a 429"() {
    upstream = () => apiError(429, "rate_limit_error");
    const res = await call({ deckName: "x", items }, { extraEnv: {} });
    assert.equal(res.status, 429);
    assert.equal((await res.json()).error, "busy");
  },
  async "per-visitor limit is a 429"() {
    const res = await call({ deckName: "x", items }, { extraEnv: { LIMITER: { limit: async () => ({ success: false }) } } });
    assert.equal(res.status, 429);
    assert.equal((await res.json()).error, "rate_limited");
  },
};

const origError = console.error;
console.error = () => {};
let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${name}\n     ${err.message}`);
  }
}
console.error = origError;
process.exit(failed ? 1 : 0);
