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
  // Block writes first so an in-flight sync can't save old data back after the clear.
  Storage.prototype.setItem = () => {};
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
      if (url.includes("/shift")) {
        const { action, transcript } = JSON.parse(init.body);
        const last = transcript.at(-1).text;
        const body =
          action === "debrief"
            ? { summary: "Nice first visit.", didWell: ["You checked her name and date of birth"], missed: ["Wash your hands first"], terms: ["Tachycardia: fast heart rate"], toReport: ["Fever 101.8 °F"], note: "Pt: Maria Lopez\nT 101.8 °F" }
            : { say: /temperature/i.test(last) ? "Sure. [She opens her mouth for the thermometer]" : "Hi. I'm Maria Lopez.", reading: /temperature/i.test(last) ? "Temperature: 101.8 °F" : "", aside: "" };
        return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.includes("/teach-back")) {
        // "slow" in the explanation earns Got it; a follow-up answer always gets Got it.
        // "Apnea" fails like a service outage.
        const { term, explanation, question } = JSON.parse(init.body);
        if (term === "Apnea") return new Response(JSON.stringify({ error: "upstream" }), { status: 502, headers: { "content-type": "application/json" } });
        const good = Boolean(question) || /slow/i.test(explanation);
        const body = good
          ? { verdict: "got_it", summary: "Nice, you've got it.", correct: ["It means a slow heart rate"], missing: [], wrong: [], followUp: question ? "" : "Why might an athlete have it?" }
          : { verdict: "partly", summary: "Close.", correct: ["It's about the heart"], missing: ["It's slow: under 60 bpm"], wrong: ["It isn't fast"], followUp: "What number counts as slow?" };
        return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
      }
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

  await step("cards from notes (AI stubbed)", async () => {
    const realFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input.url;
      if (!url.includes("/cards-from-notes")) return realFetch(input, init);
      const cards = [
        { term: "Atria", definition: "Upper chambers of the heart" },
        { term: "Ventricles", definition: "Lower chambers of the heart" },
      ];
      return new Response(JSON.stringify({ cards }), { status: 200, headers: { "content-type": "application/json" } });
    };
    try {
      await go("#/new");
      $("#toggle-notes").click();
      setValue($("#notes-text"), "The heart has two atria on top and two ventricles below.");
      $("#notes-make").click();
      await until(() => $("#notes-add"), "suggested cards");
      $("#notes-add").click();
      check($$("#card-list textarea[data-side='term']").map((t) => t.value).join() === "Atria,Ventricles", "suggestions added to the deck");
      setValue($("#deck-name"), "Heart");
      $("form").requestSubmit();
      await until(() => $$(".deck-tile").length === 3, "library with the notes deck");
    } finally {
      window.fetch = realFetch;
    }
  });

  await step("paste a list into a new deck", async () => {
    await go("#/new");
    for (const id of ["#import-panel", "#notes-panel"]) {
      check(getComputedStyle($(id)).display === "none", `${id} is really hidden until opened`);
    }
    $("#toggle-import").click();
    setValue($("#import-text"), "1. brady- - slow\n2. tachy- - fast\nnot a card\n3. -itis - inflammation");
    check($("#import-add").textContent === "Add 3 cards", "import button counts 3 cards");
    $("#import-add").click();
    check($$(".card-row").length === 3, "blank rows replaced by 3 imported cards");
    setValue($("#deck-name"), "Pasted deck");
    $("form").requestSubmit();
    await until(() => $$(".deck-tile").length === 4, "library with four decks");
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

  await step("undo the last card in flashcards", async () => {
    const snapshot = () => JSON.parse(localStorage.getItem("preppop:v1"));
    const before = snapshot();
    const label = $(".progress-label").textContent;
    const cardId = before.decks[0].cards.find((c) => $(".face.front .face-text").textContent === c.term)?.id;
    key("ArrowLeft");
    await wait(50);
    check($("#undo"), "undo offered after a mark");
    $("#undo").click();
    await wait(50);
    check($(".progress-label").textContent === label, "back on the same card");
    const after = snapshot();
    const today = Object.keys(before.activity).sort().pop();
    check(JSON.stringify(after.activity[today]) === JSON.stringify(before.activity[today]), "today's count restored");
    const was = before.decks[0].cards.find((c) => c.id === cardId);
    const now = after.decks[0].cards.find((c) => c.id === cardId);
    check(JSON.stringify(was) === JSON.stringify(now), "card restored exactly");
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
      check($(".option.is-selected") && !$("#next"), "confidence check: picking only selects");
      key("s");
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
      if ($(".lock-row")) {
        await wait(20);
        $('.lock-row [data-lock="sure"]').click();
      } else {
        $("#answer").value = "zzz";
        $(".write-form").requestSubmit();
        await wait(20);
        $('.lock-row [data-lock="sure"]').click(); // Check asks how sure first
      }
      await until(() => $("#next"), "next button");
      $("#next").click();
      await wait(20);
    }
    await until(() => $(".result .big"), "results");
    check(seen.size === 3, `saw all 3 question types (saw ${[...seen].join(", ")})`);
  });

  await step("confidence check: a lucky guess comes back tomorrow, sure-and-wrong is a blind spot", async () => {
    await go("#/new");
    setValue($("#deck-name"), "Heart rates");
    $("#toggle-import").click();
    setValue($("#import-text"), "Tachycardia - Heart rate over 100\nBradycardia - Heart rate under 60\nApnea - No breathing");
    $("#import-add").click();
    $("form").requestSubmit();
    await wait(150);
    const cards = () => JSON.parse(localStorage.getItem("preppop:v1")).decks.find((d) => d.name === "Heart rates").cards;
    const id = JSON.parse(localStorage.getItem("preppop:v1")).decks.find((d) => d.name === "Heart rates").id;
    await go(`#/deck/${id}/test`);
    // Written questions only, showing the definition, so the answers are known.
    $(".chip-check input[value='written']").checked = true;
    $(".chip-check input[value='written']").dispatchEvent(new Event("change", { bubbles: true }));
    for (let box = $(".chip-check input:checked:not([value='written'])"); box; box = $(".chip-check input:checked:not([value='written'])")) {
      box.checked = false;
      box.dispatchEvent(new Event("change", { bubbles: true }));
    }
    $('[data-mode="definition"]').click();
    await wait(20);
    check($("#confidence").checked, "confidence check is on by default");
    $("#start").click();
    await until(() => $("#q-prompt"), "first question");
    const byDef = Object.fromEntries(cards().map((c) => [c.definition, c.term]));
    let sawMixup = false;
    // Check asks how sure before showing the result; then lock in.
    const lockIn = async (typed, which) => {
      $("#answer").value = typed;
      $(".write-form").requestSubmit();
      await wait(20);
      check($(".lock-row") && !$(".feedback").textContent.trim(), "Check asks how sure before showing the answer");
      key(which === "sure" ? "s" : "g");
      await wait(20);
    };
    // First: right but guessing. Then: sure, giving the other heart-rate term. Apnea: sure and right.
    for (let i = 0; i < 3; i++) {
      const right = byDef[$("#q-prompt").textContent];
      if (i === 0) {
        await lockIn(right, "guess");
        check($(".feedback").textContent.includes("Lucky guess"), "lucky guess called out");
      } else if (right !== "Apnea") {
        await lockIn(right === "Tachycardia" ? "Bradycardia" : "Tachycardia", "sure");
        check($(".feedback").textContent.includes("is a different card"), "mix-up named in feedback");
        check($(".feedback").textContent.includes("blind spot"), "sure-and-wrong called a blind spot");
        sawMixup = true;
      } else {
        await lockIn(right, "sure");
      }
      $("#next").click();
      await wait(30);
    }
    await until(() => $(".result .big"), "results");
    const stats = cards().map((c) => c.stats ?? {});
    check(stats.reduce((n, s) => n + (s.guess ?? 0), 0) === 1, "one guess recorded");
    check(stats.reduce((n, s) => n + (s.sure ?? 0), 0) === 2, "two sure answers recorded");
    const guessed = cards().find((c) => c.stats?.guessRight);
    check(guessed && guessed.status === "learning" && guessed.srs.due > guessed.srs.last, "a lucky guess isn't marked known and comes back tomorrow");
    if (sawMixup) check($(".tag-blind") && $(".m-mixup"), "results mark the blind spot and the mix-up");

    // True/false locks in the same way, and with the check off one tap answers.
    $("#retake").click();
    await wait(30);
    $(".chip-check input[value='truefalse']").checked = true;
    $(".chip-check input[value='truefalse']").dispatchEvent(new Event("change", { bubbles: true }));
    $(".chip-check input[value='written']").checked = false;
    $(".chip-check input[value='written']").dispatchEvent(new Event("change", { bubbles: true }));
    $("#start").click();
    await until(() => $("[data-tf]"), "true/false question");
    key("t");
    await wait(20);
    check($('[data-tf="true"]').getAttribute("aria-pressed") === "true" && !$("#next"), "true/false picks, then waits for sure or guessing");
    key("g");
    await until(() => $("#next"), "true/false answered");
    await go("#/");
    await go(`#/deck/${id}/test`);
    $("#confidence").click();
    $("#start").click();
    await until(() => $("[data-tf]"), "true/false question");
    const seenBefore = cards().reduce((n, c) => n + (c.stats?.guess ?? 0) + (c.stats?.sure ?? 0), 0);
    $("[data-tf]").click();
    await wait(20);
    check($("#next") && !$(".lock-row"), "confidence check off: one tap answers");
    $("#next").click();
    await wait(20);
    check(cards().reduce((n, c) => n + (c.stats?.guess ?? 0) + (c.stats?.sure ?? 0), 0) === seenBefore, "no confidence recorded when it's off");
    // Leave it on for later runs.
    const store = await import("../js/store.js");
    store.state.settings.test.confidence = true;
    store.persist();
  });

  await step("mix-ups: noted from Write, shown on cards and Progress, sorted out in the drill", async () => {
    const deck = () => JSON.parse(localStorage.getItem("preppop:v1")).decks.find((d) => d.name === "Heart rates");
    // Start clean so this step doesn't depend on which card the test above asked first.
    const store = await import("../js/store.js"); // the app's own module instance
    for (const c of store.state.decks.find((d) => d.name === "Heart rates").cards) delete c.mixups;
    store.persist();
    await go(`#/deck/${deck().id}/write`);
    // Answer with the other heart-rate term until one is noted as a mix-up.
    for (let i = 0; i < 3 && !$(".mixup-note"); i++) {
      const card = deck().cards.find((c) => c.definition === $("#w-prompt").textContent);
      $("#answer").value = card.term === "Tachycardia" ? "Bradycardia" : "Tachycardia";
      $(".write-form").requestSubmit();
      await wait(30);
      if ($(".mixup-note")) break;
      $(".write-form").requestSubmit();
      await wait(30);
    }
    check($(".mixup-note"), "Write names the card she mixed it up with");
    $(".write-form").requestSubmit(); // moving on saves the mix-up
    await wait(30);
    check(deck().cards.some((c) => c.mixups), "mix-up saved on the card");
    await go("#/");
    check($(".today-link[href='#/mixups']"), "Today panel links to mix-ups");
    await go(`#/deck/${deck().id}/study`);
    for (let i = 0; i < 3 && !$(".face-mixup"); i++) {
      key("ArrowRight");
      await wait(30);
    }
    check($(".face-mixup"), "flip card says what it gets mixed up with");
    await go("#/progress");
    check($("#mixups-heading") && $("#confidence-heading"), "Progress shows mix-ups and confidence");
    await go("#/mixups");
    await until(() => $$(".mixup-pair").length, "mix-ups page lists the pair");
    $("#drill").click();
    for (let round = 0; round < 12 && deck().cards.some((c) => c.mixups); round++) {
      await until(() => $("#q-prompt"), "drill question");
      while (!$(".result .big")) {
        const card = deck().cards.find((c) => c.definition === $("#q-prompt").textContent);
        [...$$("[data-pick]")].find((b) => b.textContent.trim().endsWith(card.term)).click();
        await wait(20);
        check($(".mixup-contrast"), "both cards shown side by side after answering");
        $("#next").click();
        await wait(30);
      }
      if (deck().cards.some((c) => c.mixups)) $("#again").click();
    }
    check(!deck().cards.some((c) => c.mixups), "telling them apart sorts the pair out");
    check($(".result .sub").textContent.includes("No mix-ups left"), "done screen says so");
  });

  await step("explain it: feedback on her own words, a follow-up, only Got it counts as known (AI stubbed)", async () => {
    const deck = () => JSON.parse(localStorage.getItem("preppop:v1")).decks.find((d) => d.name === "Heart rates");
    await go(`#/deck/${deck().id}/write`);
    $('[data-type="explain"]').click();
    await until(() => $(".teach-form"), "explain form");
    check($(".progress-label").textContent.trim().endsWith("/ 3"), "explain rounds are short");
    const answers = [];
    const before = Object.fromEntries(deck().cards.map((c) => [c.term, c.stats?.seen ?? 0]));
    while (!$(".result .big")) {
      const term = $("#w-prompt").textContent;
      const good = term === "Bradycardia";
      setValue($("#answer"), good ? "When the heart beats slow" : "Something about the heart");
      $(".teach-form").requestSubmit();
      if (term === "Apnea") {
        // The service is down: she compares with the card and grades herself.
        await until(() => $("[data-self]"), "self-grade buttons");
        check($(".teach-card") && !$(".source-tag"), "shows the card, and no AI credit line");
        check(document.activeElement === $('[data-self="right"]'), "focus moves to the choice");
        $('[data-self="wrong"]').click();
        await wait(20);
        answers.push({ term, good: false });
        $("#next").click();
        await wait(30);
        continue;
      }
      await until(() => $(".teach-feedback"), "feedback");
      check($(".teach-card") && $(".teach-question"), "shows the card and a follow-up question");
      if (good) {
        check($(".teach-chip").textContent === "Got it", "Got it verdict shown");
        setValue($("#follow-answer"), "Their hearts pump more blood per beat");
        $(".teach-follow-form").requestSubmit();
        await until(() => $$(".teach-feedback").length === 2, "follow-up feedback");
      } else {
        check($(".teach-list.missing") && $(".teach-list.wrong"), "missing and wrong points listed");
      }
      answers.push({ term, good });
      $("#next").click();
      await wait(30);
    }
    const known = deck().cards.filter((c) => answers.some((a) => a.term === c.term && a.good)).every((c) => c.srs.last && c.status === "known");
    const missed = deck().cards.filter((c) => answers.some((a) => a.term === c.term && !a.good)).every((c) => c.status === "learning");
    check(known && missed, "Got it counts as known, the rest as still learning");
    check(deck().cards.every((c) => (c.stats?.seen ?? 0) === before[c.term] + 1), "each card recorded exactly once");

    // "I don't know" shows the card, with no empty "You wrote" box or AI credit.
    $("#again").click();
    await until(() => $(".teach-form"), "explain form again");
    $("#dont-know").click();
    await wait(20);
    check($(".teach-card") && !$(".teach-yours") && !$(".source-tag"), "I don't know shows just the card");
  });

  await step("clinical shift: talk to the patient, collect readings, report, get a debrief (AI stubbed)", async () => {
    await go("#/shift");
    check($$(".shift-list .deck-tile").length === 3, "three patients to choose from");
    await go("#/shift/fever");
    check($(".shift-empty") && $("#to-report").disabled, "starts in the room; can't report yet");
    const say = async (text) => {
      setValue($("#say"), text);
      $("#say").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await until(() => $$(".shift-line.patient").length === $$(".shift-line.you").length && !$("#say").disabled, "patient reply");
    };
    await say("Hi, I'm a student assistant. What's your full name and date of birth?");
    await say("I'm going to take your temperature now.");
    check($(".shift-reading").textContent === "Temperature: 101.8 °F" && $(".shift-readings li"), "the reading shows in the visit and in Your readings");
    $("#to-report").click();
    await until(() => $("#report"), "report form");
    setValue($("#report"), "Maria Lopez, fever 101.8 for three days.");
    $("#report-form").requestSubmit();
    await until(() => $("#debrief-h"), "debrief");
    check($(".shift-debrief-part.missing li") && $(".shift-note"), "debrief lists next steps and a chart note");
    check(document.activeElement === $("#debrief-h"), "focus moves to the debrief");
    $("#again").click();
    await wait(20);
    check($(".shift-empty"), "practice again starts fresh");
    await go("#/");
  });

  await step("word builder: decode and build medical words, practicing the part cards", async () => {
    await go("#/starters");
    $("[data-add='med-terms']")?.click();
    await wait(100);
    const deck = () => JSON.parse(localStorage.getItem("preppop:v1")).decks.find((d) => d.starter === "med-terms");
    await go(`#/deck/${deck().id}/study`);
    check([...$$(".mode-tabs a")].some((a) => a.textContent === "Words"), "Words tab on the medical terminology deck");
    await go(`#/deck/${deck().id}/words`);
    $("#start").click();
    await until(() => $("#q-prompt"), "first word");
    const { WORDS } = await import("../js/wordparts.js");
    const seenBefore = deck().cards.reduce((n, c) => n + (c.stats?.seen ?? 0), 0);
    let built = false;
    while (!$(".result .big")) {
      const prompt = $("#q-prompt").textContent;
      if ($(".q-type").textContent === "Decode") {
        const w = WORDS.find((x) => x.word === prompt);
        [...$$("[data-pick]")].find((b) => b.querySelector(".opt-text").textContent === w.meaning).click();
      } else {
        const w = WORDS.find((x) => x.meaning === prompt);
        for (const part of w.parts) {
          [...$$("[data-tile]")].find((b) => b.textContent.endsWith(part)).click();
          await wait(10);
        }
        check(!$("#check").disabled, "Check is ready once every slot is filled");
        $("#check").click();
        built = true;
      }
      await wait(20);
      check($(".feedback.good") && $(".word-reveal .word-es"), "right answer shows the parts and the Spanish word");
      $("#next").click();
      await wait(20);
    }
    check(built, "saw a build question");
    check($(".result .big").textContent === "10/10", "all right");
    check(deck().cards.reduce((n, c) => n + (c.stats?.seen ?? 0), 0) > seenBefore, "practicing words practices the part cards");
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

  await step("picture on a card: shrunk, saved, shown", async () => {
    await go("#/");
    await go(`#/deck/${sampleId()}/edit`);
    const canvas = Object.assign(document.createElement("canvas"), { width: 1400, height: 1000 });
    const g = canvas.getContext("2d");
    g.fillStyle = "#c33";
    g.fillRect(0, 0, 1400, 1000);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "diagram.png", { type: "image/png" }));
    const input = $("[data-pick-image]");
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    const preview = await until(() => $(".pic-preview img")?.naturalWidth && $(".pic-preview img"), "picture preview", 5000);
    check(preview.naturalWidth === 1024, "picture shrunk to 1024px wide");
    $("form").requestSubmit();
    await wait(200);
    await go(`#/deck/${sampleId()}/study`);
    await until(() => $(".face.front img.card-img")?.src, "picture on the flashcard");
    check($$("img:not([src])").length === 0, "no empty image tags");
  });

  await step("match game: pair every card, get a time", async () => {
    await go(`#/deck/${sampleId()}/match`);
    const deck = JSON.parse(localStorage.getItem("preppop:v1")).decks.find((d) => d.id === sampleId());
    // One wrong pair first (costs a second), then all the right ones.
    const tiles = () => $$(".match-tile[data-key]");
    const [a] = tiles();
    const wrong = tiles().find((t) => t.dataset.key.split(":")[0] !== a.dataset.key.split(":")[0]);
    a.click();
    await wait(10);
    $(`[data-key="${wrong.dataset.key}"]`).click();
    await wait(10);
    check($$(".match-tile.wrong").length === 2, "wrong pair is marked");
    const cardIds = [...new Set(tiles().map((t) => t.dataset.key.split(":")[0]))];
    for (const id of cardIds) {
      $(`[data-key="${id}:t"]`).click();
      await wait(10);
      $(`[data-key="${id}:d"]`).click();
      await wait(10);
    }
    await until(() => $(".result .big"), "match results");
    check(/s$/.test($(".result .big").textContent), "shows a time");
    check(JSON.parse(localStorage.getItem("preppop:v1")).settings.matchBest?.[deck.id] >= 1000, "best time saved (includes the 1s penalty)");
  });

  await step("test date: countdown badge, Today banner, cram", async () => {
    await go(`#/deck/${sampleId()}/edit`);
    const d = new Date();
    d.setDate(d.getDate() + 2);
    const pad = (n) => String(n).padStart(2, "0");
    setValue($("#exam-date"), `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    $("form").requestSubmit();
    await until(() => $(".exam-banner"), "test banner on Today");
    check($(".exam-badge").textContent === "Test in 2 days", "countdown badge on the deck");
    check(/You're about \d+% ready/.test($(".exam-banner .readiness-line").textContent), "Today banner shows readiness");
    $(".exam-banner a.btn").click();
    await until(() => location.hash.endsWith("/study/cram"), "cram opens flashcards");
    await go("#/progress");
    check($("#tests-heading") && /ready/.test($(".tests .readiness-line").textContent), "Progress lists the test with readiness");
  });

  await step("progress page shows practice and weak cards", async () => {
    await go("#/progress");
    check(Number($(".stat strong").textContent) >= 1, "streak of at least one day after practicing");
    check($$(".cal .cal-cell").length === 84, "12-week calendar");
    check($$(".weak li").length >= 1, "missed cards listed to work on");
  });

  await step("sync: encrypted upload, merge from another device, erase", async () => {
    const { deriveVault, open, seal } = await import("../js/sync.js");
    const vaults = new Map(); // fake server: id -> { version, data }
    const realFetch = window.fetch;
    window.fetch = async (input, init = {}) => {
      const url = typeof input === "string" ? input : input.url;
      const match = url.match(/\/vault\/([a-f0-9]{64})$/);
      if (!match) return realFetch(input, init);
      const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
      const row = vaults.get(match[1]);
      const method = init.method ?? "GET";
      if (method === "GET") return row ? json(row) : json({ error: "not_found" }, 404);
      if (method === "DELETE") return vaults.delete(match[1]), json({ deleted: true });
      const { base, data } = JSON.parse(init.body);
      if ((row?.version ?? 0) !== base) return json({ error: "conflict", ...row }, 409);
      vaults.set(match[1], { version: base + 1, data });
      return json({ version: base + 1 });
    };
    try {
      await go("#/settings");
      $("#sync-on").click();
      await until(() => $("#sync-key"), "sync key shown");
      const key = $("#sync-key").textContent;
      const { id, aesKey } = await deriveVault(key);
      const stored = vaults.get(id);
      check(stored && !stored.data.includes("deck"), "server holds only ciphertext");
      const remote = await open(aesKey, stored.data, `${id}:${stored.version}`);
      check(remote.decks.length === JSON.parse(localStorage.getItem("preppop:v1")).decks.length, "all decks uploaded");
      // Another device adds a deck and syncs first.
      remote.decks.push({ id: "otherdevice1", name: "From my laptop", subject: "history", updatedAt: Date.now(), cards: [{ id: "x1", term: "1776", definition: "Declaration", status: "new" }] });
      vaults.set(id, { version: stored.version + 1, data: await seal(aesKey, remote, `${id}:${stored.version + 1}`) });
      $("#sync-now").click();
      await until(() => JSON.parse(localStorage.getItem("preppop:v1")).decks.some((d) => d.name === "From my laptop"), "deck from the other device merged in");
      await until(() => !$("#sync-now")?.disabled, "sync finished");
      window.confirm = () => true; // turn off, and erase the cloud copy
      $("#sync-off").click();
      await until(() => $("#sync-on"), "sync turned off");
      check(vaults.size === 0, "cloud copy erased");
    } finally {
      window.fetch = realFetch;
    }
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
