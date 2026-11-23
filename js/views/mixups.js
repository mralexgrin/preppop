// Mix-ups: the pairs of cards she keeps confusing, side by side, and a short
// drill that shows one card's definition and asks which of the two terms it
// belongs to. Telling them apart counts the pair down until it's sorted out.
// Like Match, it's a side-by-side warm-up, so it doesn't change the review
// schedule or the daily count.

import { state, persist, shortcutsOn } from "../store.js";
import { esc, plural, isTyping } from "../util.js";
import { app, setTitle, view, announce } from "../ui.js";
import { langFor } from "../speech.js";
import { mixupPairs, pairDrill, noteMixup, easePair } from "../mixups.js";

const PAIRS_PER_DRILL = 6;

export function renderMixups() {
  setTitle("Mix-ups");
  const m = { phase: "list", questions: [], i: 0, picked: null, score: 0, drilled: [] };

  const header = `
    <header class="page-head">
      <div>
        <a class="back" href="#/progress">← Progress</a>
        <h1>Mix-ups</h1>
        <p class="lede">Cards you've given each other's answers for. Practice telling them apart until they're sorted out. This doesn't change your review schedule.</p>
      </div>
    </header>`;

  const draw = () => (m.phase === "list" ? drawList() : m.phase === "drill" ? drawQuestion() : drawDone());

  const drawList = () => {
    const pairs = mixupPairs(state.decks);
    if (!pairs.length) {
      app.innerHTML = `${header}
        <section class="result">
          <p class="sub">No mix-ups right now.</p>
          <p>When you give one card's answer for another in Test or Write, the pair shows up here.</p>
          <div class="actions"><a class="btn btn-primary" href="#/">Back to decks</a></div>
        </section>`;
      return;
    }
    const drillPairs = Math.min(pairs.length, PAIRS_PER_DRILL);
    app.innerHTML = `${header}
      <div class="row mixup-start">
        <button class="btn btn-primary btn-lg" type="button" id="drill">Practice ${plural(drillPairs, "pair")} · ${drillPairs * 2} questions</button>
      </div>
      <ul class="mixup-list">${pairs
        .map(
          ({ deck, a, b, count }) => `
        <li class="mixup-pair" data-subject="${deck.subject}">
          <p class="mixup-meta"><span class="subject-dot" aria-hidden="true"></span>${esc(deck.name)} · mixed up ${count === 1 ? "once" : `${count} times`}</p>
          <div class="mixup-cards">
            ${[a, b].map((c) => `<div class="mixup-card"><p class="m-prompt"${lang(deck, "term", c.term)}>${esc(c.term)}</p><p class="weak-def"${lang(deck, "definition", c.definition)}>${esc(c.definition)}</p></div>`).join('<span class="mixup-vs" aria-hidden="true">vs</span>')}
          </div>
        </li>`,
        )
        .join("")}</ul>`;
    app.querySelector("#drill").addEventListener("click", start);
  };

  const start = () => {
    const pairs = mixupPairs(state.decks).slice(0, PAIRS_PER_DRILL);
    m.questions = pairDrill(pairs);
    m.drilled = pairs.map((pair) => pair.key);
    m.i = 0;
    m.score = 0;
    m.picked = null;
    m.phase = m.questions.length ? "drill" : "list";
    draw();
    app.querySelector("#q-card")?.focus();
  };

  const drawQuestion = () => {
    const q = m.questions[m.i];
    const answered = m.picked !== null;
    const right = answered && m.picked === q.card.term;
    const last = m.i === m.questions.length - 1;
    app.innerHTML = `${header}
      <div class="progress">
        <div class="progress-track"><span style="--p:${((m.i + (answered ? 1 : 0)) / m.questions.length) * 100}"></span></div>
        <span class="progress-label">${m.i + 1} / ${m.questions.length}</span>
      </div>
      <section class="q-card def" aria-labelledby="q-prompt" id="q-card" tabindex="-1">
        <span class="face-label">Definition</span>
        <p class="q-prompt" id="q-prompt"${lang(q.deck, "definition", q.card.definition)}>${esc(q.card.definition)}</p>
      </section>
      <p class="q-instruction" id="q-instruction">Which one is it?</p>
      <div class="options two" role="group" aria-labelledby="q-instruction">
        ${q.options
          .map((opt, i) => {
            const cls = !answered ? "" : opt === q.card.term ? "is-correct" : opt === m.picked ? "is-wrong" : "dim";
            return `<button type="button" class="option ${cls}" data-pick="${i}" ${answered ? "disabled" : ""}><span class="opt-key" aria-hidden="true">${i + 1}</span><span class="opt-text"${lang(q.deck, "term", opt)}>${esc(opt)}</span>${mark(cls)}</button>`;
          })
          .join("")}
      </div>
      <div class="q-foot">
        <p class="feedback ${answered ? (right ? "good" : "bad") : ""}">${answered ? (right ? "Right!" : `Not quite. It's <strong>${esc(q.card.term)}</strong>.`) : ""}</p>
        ${
          answered
            ? `<div class="mixup-contrast">
                <p><strong${lang(q.deck, "term", q.card.term)}>${esc(q.card.term)}</strong>: ${esc(q.card.definition)}</p>
                <p><strong${lang(q.deck, "term", q.other.term)}>${esc(q.other.term)}</strong>: ${esc(q.other.definition)}</p>
              </div>
              <div class="row"><button class="btn btn-primary" type="button" id="next">${last ? "See results" : "Next"} <kbd>Enter</kbd></button></div>`
            : ""
        }
      </div>`;
    app.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => pick(q.options[Number(b.dataset.pick)])));
    const next = app.querySelector("#next");
    next?.addEventListener("click", advance);
    next?.focus();
  };

  const pick = (value) => {
    if (m.picked !== null) return;
    const q = m.questions[m.i];
    m.picked = value;
    const right = value === q.card.term;
    if (right) {
      m.score++;
      easePair(q.card, q.other);
    } else noteMixup(q.card, q.other);
    persist();
    drawQuestion();
    announce(app.querySelector(".q-foot .feedback").textContent.trim());
  };

  const advance = () => {
    if (m.picked === null) return;
    m.i++;
    m.picked = null;
    if (m.i < m.questions.length) {
      drawQuestion();
      app.querySelector("#q-card")?.focus();
      return;
    }
    m.phase = "done";
    draw();
    window.scrollTo(0, 0);
    app.querySelector(".result .big")?.focus();
  };

  const drawDone = () => {
    const total = m.questions.length;
    const remaining = new Set(mixupPairs(state.decks).map((pair) => pair.key));
    const left = remaining.size;
    const sorted = m.drilled.filter((key) => !remaining.has(key)).length;
    app.innerHTML = `${header}
      <section class="result">
        <h2 class="big" tabindex="-1">${m.score}/${total}</h2>
        <p class="sub">${sorted ? `${plural(sorted, "pair")} sorted out. ` : ""}${left ? `${plural(left, "mix-up")} left to practice.` : "No mix-ups left. Nice work."}</p>
        <div class="actions">
          ${left ? `<button class="btn btn-primary" type="button" id="again">Practice again</button>` : ""}
          <a class="btn ${left ? "btn-soft" : "btn-primary"}" href="#/progress">Back to Progress</a>
        </div>
      </section>`;
    app.querySelector("#again")?.addEventListener("click", start);
  };

  const onKey = (e) => {
    if (m.phase !== "drill" || !shortcutsOn() || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    const q = m.questions[m.i];
    if (m.picked === null && /^[12]$/.test(e.key)) pick(q.options[Number(e.key) - 1]);
    else if (e.key === "Enter" && m.picked !== null && !e.target.closest?.("a, button, input, select, textarea")) {
      e.preventDefault();
      advance();
    }
  };
  document.addEventListener("keydown", onKey);
  view.cleanup = () => document.removeEventListener("keydown", onKey);

  draw();
}

const lang = (deck, side, text) => (langFor(deck, side, text).startsWith("es") ? ' lang="es"' : "");
const mark = (cls) =>
  cls === "is-correct" ? '<span class="opt-mark"><span aria-hidden="true">✓</span><span class="visually-hidden">Correct answer</span></span>'
  : cls === "is-wrong" ? '<span class="opt-mark"><span aria-hidden="true">✗</span><span class="visually-hidden">Your answer</span></span>'
  : "";
