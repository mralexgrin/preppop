// Word Builder (tab on the "Medical terminology" starter deck): decode words
// she's never seen from their parts, and build words from a meaning. Each
// answer practices the deck's cards for the parts involved: a part she got
// right counts as right, the part she mixed up counts as missed.

import { persist, recordAnswer, shortcutsOn } from "../store.js";
import { esc, plural, isTyping } from "../util.js";
import { app, setTitle, view, deckHeader, announce, keepFocus } from "../ui.js";
import { WORDS, makeRound, partCards, meaningOf, checkBuild } from "../wordparts.js";

const ROUND = 10;

export function renderWords(deck) {
  setTitle(`${deck.name} · Word Builder`);
  const w = { phase: "intro", questions: [], i: 0, picked: [], answer: null, score: 0, missedParts: new Map() };
  const header = () => deckHeader(deck, "words", w.phase === "question" ? `<span class="progress-label">Score ${w.score}</span>` : "");

  // How often each word's parts have been practiced, so new words come first.
  const seenCount = (word) => partCards(deck, word).reduce((n, c) => n + (c.stats?.seen ?? 0), 0);
  const parts = (word) =>
    `<ul class="word-parts">${word.parts
      .map((p) => `<li><strong>${esc(p)}</strong><span>${esc(meaningOf(deck, p) || "")}</span></li>`)
      .join('<li class="word-plus" aria-hidden="true">+</li>')}</ul>`;

  const draw = () => (w.phase === "intro" ? drawIntro() : w.phase === "question" ? drawQuestion() : drawDone());

  const drawIntro = () => {
    app.innerHTML = `${header()}
      <section class="panel wide words-intro">
        <h2>Work out words you've never seen</h2>
        <p>Most medical words are built from a few parts. Know <strong>tachy-</strong> (fast), <strong>brady-</strong> (slow), <strong>cardi/o</strong> (heart), and <strong>-pnea</strong> (breathing), and you can read tachycardia, bradypnea, and more.</p>
        <p>Each round mixes two kinds of questions: <strong>decode</strong> a word by picking what it means, and <strong>build</strong> a word by tapping its parts in order. You'll also see the Spanish word, which is usually almost the same.</p>
        <div class="row"><button class="btn btn-primary btn-lg" type="button" id="start">Start · ${plural(Math.min(ROUND, WORDS.length), "word")}</button></div>
      </section>`;
    app.querySelector("#start").addEventListener("click", start);
  };

  const start = () => {
    w.questions = makeRound(WORDS, ROUND, seenCount);
    w.i = 0;
    w.score = 0;
    w.missedParts = new Map();
    reset();
    w.phase = "question";
    draw();
    app.querySelector("#q-card")?.focus();
  };

  const reset = () => {
    w.picked = [];
    w.answer = null;
  };

  const drawQuestion = () => {
    const q = w.questions[w.i];
    const answered = w.answer !== null;
    const right = answered && w.answer.right;
    const last = w.i === w.questions.length - 1;
    let body;
    if (q.kind === "decode") {
      body = `
        <p class="q-instruction" id="q-instruction">What does it mean?</p>
        <div class="options" role="group" aria-labelledby="q-instruction">
          ${q.options
            .map((opt, i) => {
              const cls = !answered ? "" : opt === q.word.meaning ? "is-correct" : opt === w.answer.value ? "is-wrong" : "dim";
              return `<button type="button" class="option ${cls}" data-pick="${i}" ${answered ? "disabled" : ""}><span class="opt-key" aria-hidden="true">${i + 1}</span><span class="opt-text">${esc(opt)}</span>${mark(cls)}</button>`;
            })
            .join("")}
        </div>`;
    } else {
      const slots = q.word.parts.map((_, i) => {
        const p = w.picked[i];
        const cls = !answered ? "" : p === q.word.parts[i] ? "is-correct" : "is-wrong";
        return p
          ? `<button type="button" class="word-slot filled ${cls}" data-unpick="${i}" ${answered ? "disabled" : ""} aria-label="${esc(p)}${answered ? "" : ", tap to remove"}">${esc(p)}</button>`
          : `<span class="word-slot" aria-hidden="true"></span>`;
      });
      body = `
        <p class="q-instruction" id="q-instruction">Build the word: tap its ${q.word.parts.length} parts in order</p>
        <div class="word-slots" aria-label="Your word so far: ${esc(w.picked.join(" + ") || "empty")}">${slots.join('<span class="word-plus" aria-hidden="true">+</span>')}</div>
        <div class="word-tray" role="group" aria-labelledby="q-instruction">
          ${q.tray
            .map((p, i) => {
              const used = w.picked.includes(p);
              return `<button type="button" class="word-tile" data-tile="${i}" aria-pressed="${used}" ${answered || used || w.picked.length >= q.word.parts.length ? "disabled" : ""}><span class="opt-key" aria-hidden="true">${i + 1}</span>${esc(p)}</button>`;
            })
            .join("")}
        </div>
        ${answered ? "" : `<div class="row"><button class="btn btn-primary" type="button" id="check" ${w.picked.length === q.word.parts.length ? "" : "disabled"}>Check <kbd>Enter</kbd></button>${w.picked.length ? `<button class="btn btn-ghost" type="button" id="undo-tile">Undo <kbd>⌫</kbd></button>` : ""}</div>`}`;
    }

    const reveal = answered
      ? `<div class="word-reveal">
          <p class="word-name">${esc(q.word.word)}</p>
          <p class="word-meaning">${esc(q.word.meaning)}</p>
          ${parts(q.word)}
          <p class="word-es">In Spanish: <strong lang="es">${esc(q.word.es)}</strong></p>
        </div>`
      : "";

    app.innerHTML = `${header()}
      <div class="progress">
        <div class="progress-track"><span style="width:${((w.i + (answered ? 1 : 0)) / w.questions.length) * 100}%"></span></div>
        <span class="progress-label">${w.i + 1} / ${w.questions.length}</span>
      </div>
      <section class="q-card ${q.kind === "build" ? "def" : ""}" aria-labelledby="q-prompt" id="q-card" tabindex="-1">
        <span class="face-label">${q.kind === "decode" ? "Word" : "Meaning"}</span>
        <span class="q-type">${q.kind === "decode" ? "Decode" : "Build"}</span>
        <p class="q-prompt" id="q-prompt">${esc(q.kind === "decode" ? q.word.word : q.word.meaning)}</p>
      </section>
      ${body}
      <div class="q-foot">
        <p class="feedback ${answered ? (right ? "good" : "bad") : ""}">${answered ? (right ? "Correct!" : "Not quite.") : ""}</p>
        ${reveal}
        ${answered ? `<div class="row"><button class="btn btn-primary" type="button" id="next">${last ? "See results" : "Next word"} <kbd>Enter</kbd></button></div>` : ""}
      </div>`;

    app.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => decode(q.options[Number(b.dataset.pick)])));
    app.querySelectorAll("[data-tile]").forEach((b) => b.addEventListener("click", () => place(q.tray[Number(b.dataset.tile)])));
    app.querySelectorAll("[data-unpick]").forEach((b) => b.addEventListener("click", () => unplace(Number(b.dataset.unpick))));
    app.querySelector("#check")?.addEventListener("click", checkWord);
    app.querySelector("#undo-tile")?.addEventListener("click", () => unplace(w.picked.length - 1));
    const next = app.querySelector("#next");
    next?.addEventListener("click", advance);
    next?.focus();
  };

  const place = (p) => {
    const q = w.questions[w.i];
    if (w.answer || w.picked.includes(p) || w.picked.length >= q.word.parts.length) return;
    w.picked = [...w.picked, p];
    drawQuestion();
    // The tile just used is disabled now: move on to the next free tile, or Check.
    (w.picked.length === q.word.parts.length ? app.querySelector("#check") : app.querySelector(".word-tile:not(:disabled)"))?.focus();
    announce(`${p} placed. ${w.picked.length} of ${q.word.parts.length} parts.`);
  };

  const unplace = (i) => {
    if (w.answer || i < 0) return;
    w.picked = w.picked.filter((_, j) => j !== i);
    keepFocus(drawQuestion);
  };

  // Which of the word's parts she got right. Decode: the parts the chosen
  // meaning's word shares with this one (picking "slow breathing" for
  // tachypnea gets -pnea right and tachy- wrong). Build: position by position.
  const grades = (q, value) => {
    if (q.kind === "build") return q.word.parts.map((p, i) => value[i] === p);
    const chosen = WORDS.find((x) => x.meaning === value);
    return q.word.parts.map((p) => value === q.word.meaning || Boolean(chosen?.parts.includes(p)));
  };

  const answer = (value, right) => {
    const q = w.questions[w.i];
    w.answer = { value, right };
    if (right) w.score++;
    const marks = grades(q, value);
    for (const [i, part] of q.word.parts.entries()) {
      const card = partCards(deck, { parts: [part] })[0];
      if (card) recordAnswer(card, marks[i], undefined, deck);
      if (!marks[i]) w.missedParts.set(part, (w.missedParts.get(part) ?? 0) + 1);
    }
    persist();
    drawQuestion();
    announce(`${right ? "Correct!" : "Not quite."} ${q.word.word}: ${q.word.meaning}.`);
  };

  const decode = (value) => {
    if (w.answer) return;
    answer(value, value === w.questions[w.i].word.meaning);
  };

  const checkWord = () => {
    const q = w.questions[w.i];
    if (w.answer || w.picked.length !== q.word.parts.length) return;
    answer([...w.picked], checkBuild(w.picked, q.word));
  };

  const advance = () => {
    if (!w.answer) return;
    w.i++;
    reset();
    if (w.i < w.questions.length) {
      drawQuestion();
      app.querySelector("#q-card")?.focus();
      return;
    }
    w.phase = "done";
    draw();
    window.scrollTo(0, 0);
  };

  const drawDone = () => {
    const total = w.questions.length;
    const missed = [...w.missedParts.entries()].sort((a, b) => b[1] - a[1]);
    app.innerHTML = `${header()}
      <section class="result">
        <h2 class="big">${w.score}/${total}</h2>
        <p class="sub">${w.score === total ? "Every word right. You can read medical words now." : "Words you worked out from their parts."}</p>
        <div class="actions">
          <button class="btn btn-primary" type="button" id="again">New round</button>
          <a class="btn btn-soft" href="#/deck/${deck.id}/study">Review the parts</a>
        </div>
      </section>
      ${
        missed.length
          ? `<section class="missed"><h2>Parts to practice</h2><ul>${missed
              .map(([p]) => `<li><p class="m-prompt">${esc(p)}</p><p class="m-answer">${esc(meaningOf(deck, p))}</p></li>`)
              .join("")}</ul></section>`
          : ""
      }`;
    app.querySelector("#again").addEventListener("click", start);
  };

  const onKey = (e) => {
    if (w.phase !== "question" || !shortcutsOn() || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    const q = w.questions[w.i];
    if (!w.answer && /^[1-9]$/.test(e.key)) {
      const n = Number(e.key) - 1;
      if (q.kind === "decode" && q.options[n] !== undefined) decode(q.options[n]);
      else if (q.kind === "build" && q.tray[n] !== undefined) place(q.tray[n]);
    } else if (!w.answer && q.kind === "build" && e.key === "Backspace") {
      e.preventDefault();
      unplace(w.picked.length - 1);
    } else if (e.key === "Enter" && !e.target.closest?.("a, button, input, select, textarea")) {
      e.preventDefault();
      if (w.answer) advance();
      else if (q.kind === "build") checkWord();
    }
  };
  document.addEventListener("keydown", onKey);
  view.cleanup = () => document.removeEventListener("keydown", onKey);

  draw();
}

const mark = (cls) =>
  cls === "is-correct" ? '<span class="opt-mark"><span aria-hidden="true">✓</span><span class="visually-hidden">Correct answer</span></span>'
  : cls === "is-wrong" ? '<span class="opt-mark"><span aria-hidden="true">✗</span><span class="visually-hidden">Your answer</span></span>'
  : "";
