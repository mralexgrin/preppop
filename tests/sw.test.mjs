import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const shell = [...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

test("the offline cache lists every app module", () => {
  const files = [
    ...readdirSync(new URL("../js", import.meta.url)).filter((f) => f.endsWith(".js")).map((f) => `js/${f}`),
    ...readdirSync(new URL("../js/views", import.meta.url)).filter((f) => f.endsWith(".js")).map((f) => `js/views/${f}`),
  ];
  const missing = files.filter((f) => !shell.includes(f));
  assert.deepEqual(missing, [], "add these to SHELL in sw.js so the app works offline");
});

test("every file in the offline cache exists", () => {
  const gone = shell.filter((f) => f !== "./" && !existsSync(new URL(`../${f}`, import.meta.url)));
  assert.deepEqual(gone, []);
});
