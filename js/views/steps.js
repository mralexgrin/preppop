// Steps: put an ordered deck's cards back in order by tapping them one by one.
// Tap a placed step to send it back. Long decks go 8 steps at a time.

import { persist, recordAnswer } from "../store.js";
import { esc, shuffle } from "../util.js";
import { app, setTitle, view, deckHeader } from "../ui.js";
import { pickWindow, scoreOrder } from "../steps.js";

export function renderSteps(deck) {
  setTitle(`${deck.name} · Steps`);
  const s = { start: 0, cards: [], pool: [], placed: [], result: null };

  const newRound = (sameWindow = false) => {
    if (!sameWindow) Object.assign(s, pickWindow(deck.cards));
    s.pool = shuffle(s.cards.map((c) => c.id));
    s.placed = [];
    s.result = null;
    draw();
  };

  const byId = (id) => s.cards.find((c) => c.id === id);

  const draw = () => {
    if (deck.cards.length < 3) {
      app.innerHTML = `${deckHeader(deck, "steps")}
        <div class="result"><p class="sub">Steps practice needs at least 3 cards in order.</p>
        <div class="actions"><a class="btn btn-primary" href="#/deck/${deck.id}/edit">Add steps</a></div></div>`;
      return;
    }
    const windowed = s.cards.length < deck.cards.length;
    const range = windowed ? `Steps ${s.start + 1}–${s.start + s.cards.length} of ${deck.cards.length}. ` : "";
    const r = s.result;

    app.innerHTML = `${deckHeader(deck, "steps")}
      <p class="steps-intro">${range}${r ? "Here's how you did." : "Tap the steps in the right order. Tap a step in your list to take it back."}</p>
      <section class="steps-board" aria-label="Your order">
        <h2 class="steps-heading">Your order</h2>
        ${
          s.placed.length
            ? `<ol class="steps-list placed" style="--start: ${s.start + 1}">${s.placed
                .map((id, i) => {
                  const mark = r ? (r.marks[i] ? "is-right" : "is-wrong") : "";
                  return `<li><button type="button" class="step ${mark}" data-unplace="${i}" ${r ? "disabled" : ""}>
                    <span class="step-text">${esc(byId(id).term)}</span>${r ? `<span class="step-mark" aria-label="${r.marks[i] ? "right place" : "wrong place"}">${r.marks[i] ? "✓" : "✗"}</span>` : ""}
                  </button></li>`;
                })
                .join("")}</ol>`
            : `<p class="steps-empty">Your steps will line up here.</p>`
        }
      </section>
      ${
        s.pool.length
          ? `<section aria-label="Steps to place">
              <h2 class="steps-heading">Tap the next step</h2>
              <ul class="steps-list pool">${s.pool
                .map((id) => `<li><button type="button" class="step" data-place="${id}"><span class="step-text">${esc(byId(id).term)}</span></button></li>`)
                .join("")}</ul>
            </section>`
          : ""
      }
      ${
        !r && !s.pool.length
          ? `<div class="row"><button class="btn btn-primary btn-lg" type="button" id="check">Check my order</button></div>`
          : ""
      }
      ${
        r
          ? `<section class="result steps-result">
              <p class="big">${r.correct}/${r.total}</p>
              <p class="sub">${r.correct === r.total ? "Perfect order." : "steps in the right place."}</p>
              <div class="actions">
                <button class="btn btn-primary" type="button" id="again">Try again</button>
                ${windowed ? `<button class="btn btn-soft" type="button" id="next-set">Different steps</button>` : ""}
              </div>
            </section>
            <section class="missed">
              <h2>The right order</h2>
              <ol class="correct-order" start="${s.start + 1}">${s.cards
                .map((c) => `<li><p class="m-prompt">${esc(c.term)}</p>${c.definition ? `<p class="weak-def">${esc(c.definition)}</p>` : ""}</li>`)
                .join("")}</ol>
            </section>`
          : ""
      }`;

    app.querySelectorAll("[data-place]").forEach((b) =>
      b.addEventListener("click", () => {
        s.pool = s.pool.filter((id) => id !== b.dataset.place);
        s.placed.push(b.dataset.place);
        draw();
        (app.querySelector("[data-place]") ?? app.querySelector("#check"))?.focus({ preventScroll: true });
      }),
    );
    app.querySelectorAll("[data-unplace]").forEach((b) =>
      b.addEventListener("click", () => {
        const [id] = s.placed.splice(Number(b.dataset.unplace), 1);
        s.pool.push(id);
        draw();
        app.querySelector(`[data-place="${id}"]`)?.focus({ preventScroll: true });
      }),
    );
    app.querySelector("#check")?.addEventListener("click", check);
    app.querySelector("#again")?.addEventListener("click", () => newRound(true));
    app.querySelector("#next-set")?.addEventListener("click", () => newRound(false));
  };

  const check = () => {
    s.result = scoreOrder(s.placed, s.cards.map((c) => c.id));
    s.placed.forEach((id, i) => recordAnswer(byId(id), s.result.marks[i], undefined, deck));
    persist();
    draw();
    app.querySelector(".steps-result")?.scrollIntoView({ behavior: "smooth", block: "center" });
    app.querySelector("#again")?.focus({ preventScroll: true });
  };

  view.cleanup = null;
  newRound();
}
