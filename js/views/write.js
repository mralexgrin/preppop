// Write mode: see one side, type the other. Rounds of ROUND_SIZE cards,
// cards she doesn't know yet first. Answers are graded leniently (js/answer.js)
// and she can overrule the grade with "I was right".

import { persist, recordAnswer } from "../store.js";
import { esc, plural, shuffle } from "../util.js";
import { app, setTitle, view, deckHeader } from "../ui.js";
import { ROUND_SIZE } from "../srs.js";
import { checkAnswer, countsAsCorrect, needsAccentKeys, ACCENT_KEYS } from "../answer.js";
import { canSpeak, speak, langFor, SPEAKER_ICON } from "../speech.js";

const LABEL = { term: "Term", definition: "Definition" };

export function renderWrite(deck) {
  setTitle(`${deck.name} · Write`);
  const w = { typeSide: "term", onlyLearning: false, queue: [], i: 0, result: null, score: 0, missed: [], pool: [] };

  const buildPool = () => {
    const cards = w.onlyLearning ? deck.cards.filter((c) => c.status !== "known") : deck.cards;
    // Unknown cards first, each group shuffled.
    return [...shuffle(cards.filter((c) => c.status !== "known")), ...shuffle(cards.filter((c) => c.status === "known"))];
  };

  const startRound = (cards) => {
    w.queue = cards.slice(0, ROUND_SIZE);
    w.pool = cards.slice(ROUND_SIZE);
    w.i = 0;
    w.result = null;
    w.score = 0;
    w.missed = [];
    draw();
  };
  const restart = () => startRound(buildPool());

  const header = deckHeader(deck, "write");

  const toolbar = () => {
    const notKnown = deck.cards.filter((c) => c.status !== "known").length;
    return `
      <div class="toolbar">
        <div class="seg" role="group" aria-label="What you type">
          <button type="button" data-type="term" aria-pressed="${w.typeSide === "term"}">Type the term</button>
          <button type="button" data-type="definition" aria-pressed="${w.typeSide === "definition"}">Type the definition</button>
        </div>
        <div class="seg" role="group" aria-label="Which cards">
          <button type="button" data-only="all" aria-pressed="${!w.onlyLearning}">All (${deck.cards.length})</button>
          <button type="button" data-only="learning" aria-pressed="${w.onlyLearning}" ${notKnown ? "" : "disabled"}>Not known yet (${notKnown})</button>
        </div>
      </div>`;
  };

  const bindToolbar = () => {
    app.querySelectorAll("[data-type]").forEach((b) =>
      b.addEventListener("click", () => {
        w.typeSide = b.dataset.type;
        restart();
      }),
    );
    app.querySelectorAll("[data-only]").forEach((b) =>
      b.addEventListener("click", () => {
        w.onlyLearning = b.dataset.only === "learning";
        restart();
      }),
    );
  };

  const draw = () => {
    if (!deck.cards.length) {
      app.innerHTML = `${header}
        <div class="result"><p class="sub">This deck has no cards yet.</p>
        <div class="actions"><a class="btn btn-primary" href="#/deck/${deck.id}/edit">Add cards</a></div></div>`;
      return;
    }
    if (!w.queue.length) {
      app.innerHTML = `${header}${toolbar()}
        <div class="result"><p class="sub">You know every card in this deck. Switch to All to keep practicing.</p></div>`;
      bindToolbar();
      return;
    }
    if (w.i >= w.queue.length) return drawDone();

    const card = w.queue[w.i];
    const showSide = w.typeSide === "term" ? "definition" : "term";
    const expected = card[w.typeSide];
    const r = w.result;
    const accents = needsAccentKeys(expected, deck.subject);
    const long = expected.length > 40;

    app.innerHTML = `${header}${toolbar()}
      <div class="progress">
        <div class="progress-track"><span style="width:${((w.i + (r ? 1 : 0)) / w.queue.length) * 100}%"></span></div>
        <span class="progress-label">${w.i + 1} / ${w.queue.length}</span>
      </div>
      <section class="q-card ${showSide === "definition" ? "def" : ""}" aria-labelledby="w-prompt">
        <span class="face-label">${LABEL[showSide]}</span>
        <p class="q-prompt" id="w-prompt">${esc(card[showSide])}</p>
      </section>
      <form class="write-form" novalidate>
        <label class="field">
          <span class="field-label">Type the ${w.typeSide}</span>
          ${
            long
              ? `<textarea class="input write-input" id="answer" rows="3" autocomplete="off" autocapitalize="off" spellcheck="false" ${r ? "readonly" : ""}>${esc(r?.typed ?? "")}</textarea>`
              : `<input class="input write-input" id="answer" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" value="${esc(r?.typed ?? "")}" ${r ? "readonly" : ""}>`
          }
        </label>
        ${
          accents && !r
            ? `<div class="accent-keys" role="group" aria-label="Insert accented letter">${ACCENT_KEYS.map((k) => `<button type="button" class="accent-key" data-char="${k}">${k}</button>`).join("")}</div>`
            : ""
        }
        ${
          r
            ? feedbackHTML(r, expected)
            : `<div class="row write-actions">
                <button class="btn btn-primary" type="submit">Check <kbd>Enter</kbd></button>
                <button class="btn btn-ghost" type="button" id="dont-know">I don't know</button>
              </div>`
        }
      </form>`;

    bindToolbar();
    const form = app.querySelector(".write-form");
    const input = app.querySelector("#answer");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (w.result) advance();
      else check(input.value);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && input.tagName === "TEXTAREA") {
        e.preventDefault();
        form.requestSubmit();
      }
    });
    app.querySelector("#dont-know")?.addEventListener("click", () => check(""));
    app.querySelectorAll(".accent-key").forEach((b) =>
      b.addEventListener("click", () => {
        const { selectionStart: s, selectionEnd: e, value } = input;
        input.value = value.slice(0, s) + b.dataset.char + value.slice(e);
        input.focus();
        input.setSelectionRange(s + 1, s + 1);
      }),
    );
    app.querySelector("#hear")?.addEventListener("click", () => speak(expected, langFor(deck, w.typeSide, expected)));
    app.querySelector("#overrule")?.addEventListener("click", () => {
      w.result.overruled = true;
      advance();
    });
    const next = app.querySelector("#next");
    if (next) next.focus({ preventScroll: true });
    else input.focus({ preventScroll: true });
  };

  const feedbackHTML = (r, expected) => {
    const right = countsAsCorrect(r.verdict);
    const messages = {
      correct: "Correct!",
      accent: "Correct! Watch the accents:",
      almost: "Almost. Check the spelling:",
      wrong: "Not quite. The answer is:",
      empty: "The answer is:",
    };
    return `
      <div class="write-feedback ${right ? "good" : "bad"}" role="status">
        <p class="feedback ${right ? "good" : "bad"}">${messages[r.verdict]}</p>
        ${r.verdict !== "correct" ? `<p class="expected">${esc(expected)}</p>` : ""}
        ${canSpeak() ? `<button type="button" class="text-btn hear" id="hear">${SPEAKER_ICON}<span>Hear it</span></button>` : ""}
        ${!right && r.typed.trim() ? `<p class="typed"><span class="visually-hidden">You wrote: </span>${esc(r.typed)}</p>` : ""}
      </div>
      <div class="row write-actions">
        <button class="btn btn-primary" type="submit" id="next">${w.i === w.queue.length - 1 ? "See results" : "Next"} <kbd>Enter</kbd></button>
        ${!right && r.typed.trim() ? `<button class="btn btn-ghost" type="button" id="overrule">I was right</button>` : ""}
      </div>`;
  };

  const check = (typed) => {
    const card = w.queue[w.i];
    w.result = { typed, ...checkAnswer(typed, card[w.typeSide]) };
    draw();
  };

  // The grade is saved when moving on, so "I was right" can still change it.
  const advance = () => {
    const card = w.queue[w.i];
    const r = w.result;
    const correct = r.overruled || countsAsCorrect(r.verdict);
    recordAnswer(card, correct);
    persist();
    if (correct) w.score++;
    else w.missed.push({ card, typed: r.typed });
    w.i++;
    w.result = null;
    draw();
  };

  const drawDone = () => {
    const total = w.queue.length;
    const pct = Math.round((w.score / total) * 100);
    app.innerHTML = `${header}
      <section class="result">
        <p class="big">${w.score}/${total}</p>
        <p class="sub">${pct}% correct.${w.pool.length ? ` ${plural(w.pool.length, "card")} left in this deck.` : ""}</p>
        <div class="actions">
          ${w.missed.length ? `<button class="btn btn-primary" type="button" id="retry">Practice ${w.missed.length} missed again</button>` : ""}
          ${w.pool.length ? `<button class="btn ${w.missed.length ? "btn-soft" : "btn-primary"}" type="button" id="more">Next ${plural(Math.min(w.pool.length, ROUND_SIZE), "card")}</button>` : ""}
          <button class="btn btn-soft" type="button" id="again">Start over</button>
          <a class="btn btn-ghost" href="#/">All decks</a>
        </div>
      </section>
      ${
        w.missed.length
          ? `<section class="missed"><h2>To practice</h2><ul>${w.missed
              .map(
                ({ card, typed }) => `
            <li>
              <p class="m-prompt">${esc(card[w.typeSide === "term" ? "definition" : "term"])}</p>
              <p class="m-answer">✓ ${esc(card[w.typeSide])}</p>
              ${typed.trim() ? `<p class="m-picked"><span class="visually-hidden">You wrote: </span>${esc(typed)}</p>` : ""}
            </li>`,
              )
              .join("")}</ul></section>`
          : ""
      }`;
    app.querySelector("#retry")?.addEventListener("click", () => startRound(shuffle(w.missed.map((m) => m.card))));
    app.querySelector("#more")?.addEventListener("click", () => startRound(w.pool));
    app.querySelector("#again").addEventListener("click", restart);
  };

  view.cleanup = null;
  restart();
}
