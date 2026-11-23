import { test } from "node:test";
import assert from "node:assert/strict";
import { explainCard, teachBack, writeWrongAnswers, makeCardsFromNotes } from "../js/ai.js";
import { session } from "../js/profiles.js";

test("AI requests carry the learner's level and nothing else about them", async () => {
  session.registry = { active: "main", list: [{ id: "main", name: "Maya Rodriguez", avatar: "🦉", level: "elementary", createdAt: 1 }] };
  const sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push({ url: String(url), body: JSON.parse(init.body) });
    const path = new URL(url).pathname;
    const data = {
      "/explain": { explanation: "x", example: "", memoryTrick: "", cardIssue: "" },
      "/teach-back": { verdict: "got_it", summary: "", correct: [], missing: [], wrong: [], followUp: "" },
      "/wrong-answers": { answers: {} },
      "/cards-from-notes": { cards: [] },
    }[path];
    return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
  };
  await explainCard({ term: "Mars", definition: "Red planet", subject: "science" });
  await teachBack({ term: "Mars", definition: "Red planet", subject: "science", explanation: "the red one" });
  await writeWrongAnswers({ deckName: "Space", items: [{ key: "a", shows: "term", prompt: "Mars", answer: "Red planet" }] });
  await makeCardsFromNotes({ notes: "Mars is the red planet.", subject: "science", deckName: "Space" });
  assert.equal(sent.length, 4);
  for (const { url, body } of sent) {
    assert.equal(body.level, "elementary", url);
    const text = JSON.stringify(body);
    assert.ok(!text.includes("Maya") && !text.includes("🦉") && !("name" in body) && !("avatar" in body), `${url} sends nothing about the learner but the level`);
  }
  session.registry = null;
});
