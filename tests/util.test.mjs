import { test } from "node:test";
import assert from "node:assert/strict";
import { esc, plural, normalize, shuffle, hash } from "../js/util.js";

test("esc escapes HTML special characters", () => {
  assert.equal(esc(`<b>"Tom" & 'Jerry'</b>`), "&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;");
  assert.equal(esc(null), "");
});

test("plural adds s except for one", () => {
  assert.equal(plural(1, "card"), "1 card");
  assert.equal(plural(0, "card"), "0 cards");
  assert.equal(plural(3, "deck"), "3 decks");
});

test("normalize trims, lowercases, and collapses spaces", () => {
  assert.equal(normalize("  The   Red\nPlanet "), "the red planet");
});

test("shuffle keeps every item and doesn't mutate the input", () => {
  const input = [1, 2, 3, 4, 5];
  const out = shuffle(input);
  assert.deepEqual([...out].sort(), input);
  assert.deepEqual(input, [1, 2, 3, 4, 5]);
});

test("hash is stable and differs for different text", () => {
  assert.equal(hash("mitochondria"), hash("mitochondria"));
  assert.notEqual(hash("mitochondria"), hash("ribosome"));
});
