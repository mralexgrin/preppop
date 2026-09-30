// Browser smoke test for the core flows. Run it in the page's console on the
// local preview (it WIPES this browser's PrepPop data for localhost):
//   (await import("/tests/browser-smoke.js?" + Date.now())).reset();   // wipes data, reloads
//   await (await import("/tests/browser-smoke.js?" + Date.now())).flows();
// It stubs window.fetch for the answer service so no network calls happen.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const key = (k) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
const setValue = (el, v) => {
  el.value = v;
  el.dispatchEvent(new Event("input", { bubbles: true }));
};
async function until(fn, label, ms = 3000) {
  for (let t = 0; t < ms; t += 50) {
    const v = fn();
    if (v) return v;
    await wait(50);
  }
  throw new Error(`timed out waiting for ${label}`);
}
async function go(hash) {
  location.hash = hash;
  await wait(120);
}
function check(cond, message) {
  if (!cond) throw new Error(`FAILED: ${message}`);
}

// Two-phase so the app starts from clean storage: call reset(), then run() again after reload.
export async function reset() {
  localStorage.clear();
  location.hash = "#/";
  location.reload();
}

export async function flows({ stubAnswers = true } = {}) {
  const results = [];
  const step = async (name, fn) => {
    await fn();
    results.push(`ok  ${name}`);
  };
  window.confirm = () => true;
  if (stubAnswers) {
    const realFetch = window.__realFetch ?? window.fetch.bind(window);
    window.__realFetch = realFetch;
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input.url;
      if (!url.includes("/wrong-answers")) return realFetch(input, init);
      const { items } = JSON.parse(init.body);
      const answers = Object.fromEntries(items.map((it) => [it.key, [`Stub A ${it.key}`, `Stub B ${it.key}`, `Stub C ${it.key}`]]));
      return new Response(JSON.stringify({ answers }), { status: 200, headers: { "content-type": "application/json" } });
    };
  }

  await step("empty state offers a sample deck", async () => {
    await go("#/");
    check($("#sample"), "sample button missing (storage not empty? call reset() first)");
    $("#sample").click();
    await until(() => $$(".deck-tile").length === 1, "sample deck tile");
  });

  await step("create a deck in the editor", async () => {
    await go("#/new");
    $("form").requestSubmit();
    check($("#form-error").textContent.includes("name"), "missing-name error");
    setValue($("#deck-name"), "Smoke deck");
    const tas = $$("#card-list textarea");
    setValue(tas[0], "uno");
    setValue(tas[1], "one");
    setValue(tas[2], "dos");
    setValue(tas[3], "two");
    $("form").requestSubmit();
    await until(() => $$(".deck-tile").length === 2, "library with two decks after save");
  });

  const sampleId = () => JSON.parse(localStorage.getItem("preppop:v1")).decks[0].id;

  await step("flashcards flip and mark", async () => {
    await go(`#/deck/${sampleId()}/study`);
    $("#flip").click();
    check($("#flip").classList.contains("flipped"), "card flipped");
    key("ArrowRight");
    await wait(50);
    check($(".progress-label").textContent.startsWith("2 /"), "advanced to card 2");
    const deck = JSON.parse(localStorage.getItem("preppop:v1")).decks[0];
    check(deck.cards.some((c) => c.status === "known"), "a card saved as known");
  });

  await step("delete a card while studying", async () => {
    const before = JSON.parse(localStorage.getItem("preppop:v1")).decks[0].cards.length;
    $("#delete-card").click();
    await wait(50);
    const after = JSON.parse(localStorage.getItem("preppop:v1")).decks[0].cards.length;
    check(after === before - 1, "card count dropped by one");
  });

  await step("test mode with AI answers (stubbed)", async () => {
    await go(`#/deck/${sampleId()}/test`);
    $("#start").click();
    await until(() => $(".q-prompt"), "first question");
    check($$(".option").length === 4, "four options");
    const total = Number($$(".progress-label").pop().textContent.split("/")[1]);
    for (let i = 0; i < total; i++) {
      key("1");
      await wait(20);
      $("#next").click();
      await wait(20);
    }
    await until(() => $(".result .big"), "results screen");
  });

  await step("settings page renders", async () => {
    await go("#/settings");
    check($("#clear-cache"), "clear cache button");
  });

  await step("delete a deck from the library", async () => {
    await go("#/");
    const n = $$(".deck-tile").length;
    $$("[data-delete-deck]").pop().click();
    await wait(50);
    check($$(".deck-tile").length === n - 1, "deck removed");
  });

  return results;
}
