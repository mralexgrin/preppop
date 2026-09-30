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

  await step("empty state leads to starter decks", async () => {
    await go("#/");
    check($("#starters"), "starter decks button missing (storage not empty? call reset() first)");
    await go("#/starters");
    $("[data-add='cell-parts']").click();
    await until(() => $("[data-add='cell-parts']") === null, "starter added");
    await go("#/");
    await until(() => $$(".deck-tile").length === 1, "starter deck tile");
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

  await step("paste a list into a new deck", async () => {
    await go("#/new");
    $("#toggle-import").click();
    setValue($("#import-text"), "1. brady- - slow\n2. tachy- - fast\nnot a card\n3. -itis - inflammation");
    check($("#import-add").textContent === "Add 3 cards", "import button counts 3 cards");
    $("#import-add").click();
    check($$(".card-row").length === 3, "blank rows replaced by 3 imported cards");
    setValue($("#deck-name"), "Pasted deck");
    $("form").requestSubmit();
    await until(() => $$(".deck-tile").length === 3, "library with three decks");
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

  await step("missed cards show up in Today's review", async () => {
    await go(`#/deck/${sampleId()}/study`);
    key("ArrowLeft"); // still learning -> due today
    await wait(50);
    await go("#/");
    check($(".today-line").textContent.includes("ready to review"), "today panel shows due cards");
    await go("#/review");
    const total = Number($(".progress-label").textContent.split("/")[1]);
    check(total >= 1, "review has cards");
    for (let i = 0; i < total; i++) {
      key("ArrowRight");
      await wait(30);
    }
    await until(() => $(".result .big"), "review done screen");
    await go("#/");
    check(!$(".today-line").textContent.includes("ready to review"), "nothing due after review");
  });

  await step("write mode grades typed answers leniently", async () => {
    await go(`#/deck/${sampleId()}/write`);
    const deck = JSON.parse(localStorage.getItem("preppop:v1")).decks[0];
    const prompt = $("#w-prompt").textContent;
    const card = deck.cards.find((c) => c.definition === prompt);
    $("#answer").value = "  " + card.term.toUpperCase() + "!";
    $(".write-form").requestSubmit();
    await wait(30);
    check($(".write-feedback.good"), "shouted answer with punctuation still correct");
    $(".write-form").requestSubmit();
    await wait(30);
    $("#answer").value = "zzzz";
    $(".write-form").requestSubmit();
    await wait(30);
    check($(".write-feedback.bad") && $("#overrule"), "wrong answer shows the right one and an override");
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

  await step("test with every question type", async () => {
    await go("#/"); // the previous step ends on this same URL
    await go(`#/deck/${sampleId()}/test`);
    // Each change re-renders the setup, so look the boxes up again every time.
    for (let box = $(".chip-check input:not(:checked)"); box; box = $(".chip-check input:not(:checked)")) {
      box.checked = true;
      box.dispatchEvent(new Event("change", { bubbles: true }));
    }
    check($$(".chip-check input:checked").length === 3, "all three types selected");
    $("#start").click();
    await until(() => $(".q-prompt"), "first question");
    const total = Number($$(".progress-label").pop().textContent.split("/")[1]);
    const seen = new Set();
    for (let i = 0; i < total; i++) {
      const type = $(".q-type").textContent;
      seen.add(type);
      if ($("[data-pick]")) $("[data-pick]").click();
      else if ($("[data-tf]")) $("[data-tf]").click();
      else {
        $("#answer").value = "zzz";
        $(".write-form").requestSubmit();
      }
      await until(() => $("#next"), "next button");
      $("#next").click();
      await wait(20);
    }
    await until(() => $(".result .big"), "results");
    check(seen.size === 3, `saw all 3 question types (saw ${[...seen].join(", ")})`);
  });

  await step("steps: reorder in the editor, then put steps in order", async () => {
    await go("#/new");
    setValue($("#deck-name"), "Morning routine");
    $("#toggle-import").click();
    setValue($("#import-text"), "second - b\nfirst - a\nthird - c");
    $("#import-add").click();
    $$(".card-row")[1].querySelector("[data-move='-1']").click(); // move "first" above "second"
    check($$("#card-list textarea[data-side='term']")[0].value === "first", "moved card up");
    $("#ordered").click();
    $("form").requestSubmit();
    await wait(150);
    const deck = JSON.parse(localStorage.getItem("preppop:v1")).decks.find((d) => d.name === "Morning routine");
    check(deck.ordered === true, "deck saved as ordered");
    await go(`#/deck/${deck.id}/steps`);
    for (const term of ["first", "second", "third"]) {
      [...$$("[data-place]")].find((b) => b.textContent.trim() === term).click();
      await wait(10);
    }
    $("#check").click();
    await wait(30);
    check($(".steps-result .big").textContent === "3/3", "all three steps in the right place");
  });

  await step("progress page shows practice and weak cards", async () => {
    await go("#/progress");
    check(Number($(".stat strong").textContent) >= 1, "streak of at least one day after practicing");
    check($$(".cal .cal-cell").length === 84, "12-week calendar");
    check($$(".weak li").length >= 1, "missed cards listed to work on");
  });

  await step("backup downloads and restores", async () => {
    await go("#/settings");
    let captured = null;
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) captured = { name: this.download, href: this.href };
      else origClick.call(this);
    };
    try {
      $("#download").click();
      await until(() => captured, "backup download");
    } finally {
      HTMLAnchorElement.prototype.click = origClick;
    }
    const text = await (await fetch(captured.href)).text();
    const decksBefore = JSON.parse(localStorage.getItem("preppop:v1")).decks.length;
    await go("#/");
    $$("[data-delete-deck]")[0].click();
    await wait(50);
    await go("#/settings");
    const dt = new DataTransfer();
    dt.items.add(new File([text], captured.name, { type: "application/json" }));
    const input = $("#restore");
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await until(() => $("#add-decks"), "restore panel");
    $("#add-decks").click();
    await until(() => JSON.parse(localStorage.getItem("preppop:v1")).decks.length === decksBefore, "deleted deck restored");
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
