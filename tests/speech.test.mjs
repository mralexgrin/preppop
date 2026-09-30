import { test } from "node:test";
import assert from "node:assert/strict";
import { langFor } from "../js/speech.js";

test("Spanish decks read the term in Spanish and the definition in English", () => {
  const deck = { subject: "spanish" };
  assert.equal(langFor(deck, "term", "comer"), "es-ES");
  assert.equal(langFor(deck, "definition", "to eat"), "en-US");
});

test("a Spanish-looking side in a Spanish deck is read in Spanish", () => {
  assert.equal(langFor({ subject: "spanish" }, "definition", "¿Cómo estás?"), "es-ES");
});

test("other subjects read in English", () => {
  assert.equal(langFor({ subject: "clinical" }, "term", "tachycardia"), "en-US");
  assert.equal(langFor(undefined, "term", "x"), "en-US");
});
