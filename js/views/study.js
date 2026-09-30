import { persist } from "../store.js";
import { esc, plural, shuffle, isTyping } from "../util.js";
import { app, toast, setTitle, statusChip, view } from "../ui.js";

export function renderStudy(deck) {
  setTitle(deck.name);
  const s = { front: "term", onlyLearning: false, order: [], i: 0, flipped: false, tally: { known: 0, learning: 0 } };
  const notKnown = () => deck.cards.filter((c) => c.status !== "known");

  const start = ({ shuffled = false } = {}) => {
    const pool = s.onlyLearning ? notKnown() : deck.cards;
    s.order = (shuffled ? shuffle(pool) : pool).map((c) => c.id);
    s.i = 0;
    s.flipped = false;
    s.tally = { known: 0, learning: 0 };
    draw();
  };

  const header = `
    <header class="page-head">
      <div>
        <a class="back" href="#/">← Decks</a>
        <h1>${esc(deck.name)}</h1>
      </div>
      <a class="btn btn-soft" href="#/deck/${deck.id}/test">Switch to Test</a>
    </header>`;

  const draw = () => {
    if (!deck.cards.length) {
      app.innerHTML = `${header}
        <div class="result"><p class="sub">This deck has no cards yet.</p>
        <div class="actions"><a class="btn btn-primary" href="#/deck/${deck.id}/edit">Add cards</a></div></div>`;
      return;
    }

    const remaining = notKnown().length;
    const toolbar = `
      <div class="toolbar">
        <div class="seg" role="group" aria-label="Show first">
          <button type="button" data-front="term" aria-pressed="${s.front === "term"}">Term first</button>
          <button type="button" data-front="definition" aria-pressed="${s.front === "definition"}">Definition first</button>
        </div>
        <div class="seg" role="group" aria-label="Which cards">
          <button type="button" data-only="all" aria-pressed="${!s.onlyLearning}">All (${deck.cards.length})</button>
          <button type="button" data-only="learning" aria-pressed="${s.onlyLearning}" ${remaining ? "" : "disabled"}>Not known yet (${remaining})</button>
        </div>
        <button class="btn btn-ghost" type="button" id="shuffle">Shuffle</button>
      </div>`;

    if (s.i >= s.order.length) {
      app.innerHTML = `${header}${toolbar}
        <section class="result">
          <p class="big">Round done</p>
          <p class="sub">You went through ${plural(s.order.length, "card")}.</p>
          <div class="tallies">
            <div class="tally know"><strong>${s.tally.known}</strong>Know it</div>
            <div class="tally learn"><strong>${s.tally.learning}</strong>Still learning</div>
          </div>
          <div class="actions">
            ${remaining ? `<button class="btn btn-primary" type="button" id="review">Review ${plural(remaining, "card")} not known yet</button>` : ""}
            <button class="btn ${remaining ? "btn-soft" : "btn-primary"}" type="button" id="restart">Study all again</button>
            <a class="btn btn-soft" href="#/deck/${deck.id}/test">Take a test</a>
          </div>
        </section>`;
      bindToolbar();
      app.querySelector("#review")?.addEventListener("click", () => {
        s.onlyLearning = true;
        start();
      });
      app.querySelector("#restart").addEventListener("click", () => {
        s.onlyLearning = false;
        start();
      });
      return;
    }

    const card = deck.cards.find((c) => c.id === s.order[s.i]);
    const back = s.front === "term" ? "definition" : "term";
    const label = { term: "Term", definition: "Definition" };
    app.innerHTML = `${header}${toolbar}
      <div class="progress">
        <div class="progress-track"><span style="width:${(s.i / s.order.length) * 100}%"></span></div>
        <span class="progress-label">${s.i + 1} / ${s.order.length}</span>
      </div>
      <button type="button" class="flip-card ${s.flipped ? "flipped" : ""}" id="flip" aria-describedby="flip-live">
        <span class="flip-inner">
          <span class="face front" aria-hidden="${s.flipped}">
            <span class="face-label">${label[s.front]}</span>
            <span class="face-status">${statusChip(card.status)}</span>
            <span class="face-text">${esc(card[s.front])}</span>
            <span class="face-hint">Tap to flip</span>
          </span>
          <span class="face back" aria-hidden="${!s.flipped}">
            <span class="face-label">${label[back]}</span>
            <span class="face-text">${esc(card[back])}</span>
            <span class="face-hint">Tap to flip back</span>
          </span>
        </span>
      </button>
      <p class="visually-hidden" id="flip-live" aria-live="polite">${s.flipped ? "Showing back" : "Showing front"}</p>
      <div class="mark-row">
        <button class="btn btn-learn" type="button" data-mark="learning"><kbd>←</kbd> Still learning</button>
        <button class="btn btn-know" type="button" data-mark="known">I know it <kbd>→</kbd></button>
      </div>
      <p class="kbd-hint">Space to flip · ← still learning · → I know it</p>
      <p class="card-tools"><button class="text-btn danger" type="button" id="delete-card">Delete this card</button></p>`;

    bindToolbar();
    const flipBtn = app.querySelector("#flip");
    flipBtn.addEventListener("click", flip);
    app.querySelectorAll("[data-mark]").forEach((b) => b.addEventListener("click", () => mark(b.dataset.mark)));
    app.querySelector("#delete-card").addEventListener("click", () => deleteCard(card));
  };

  const deleteCard = (card) => {
    if (!confirm(`Delete this card?\n\n${card.term}\n\nThis can't be undone.`)) return;
    deck.cards = deck.cards.filter((c) => c !== card);
    s.order = s.order.filter((id) => id !== card.id);
    s.flipped = false;
    persist();
    draw();
    toast("Card deleted");
  };

  const bindToolbar = () => {
    app.querySelectorAll("[data-front]").forEach((b) =>
      b.addEventListener("click", () => {
        s.front = b.dataset.front;
        s.flipped = false;
        draw();
      }),
    );
    app.querySelectorAll("[data-only]").forEach((b) =>
      b.addEventListener("click", () => {
        s.onlyLearning = b.dataset.only === "learning";
        start();
      }),
    );
    app.querySelector("#shuffle").addEventListener("click", () => {
      start({ shuffled: true });
      toast("Cards shuffled");
    });
  };

  const flip = () => {
    const flipBtn = app.querySelector("#flip");
    if (!flipBtn) return;
    s.flipped = !s.flipped;
    flipBtn.classList.toggle("flipped", s.flipped);
    flipBtn.querySelector(".front").setAttribute("aria-hidden", s.flipped);
    flipBtn.querySelector(".back").setAttribute("aria-hidden", !s.flipped);
    app.querySelector("#flip-live").textContent = s.flipped ? "Showing back" : "Showing front";
  };

  const mark = (status) => {
    if (s.i >= s.order.length) return;
    const card = deck.cards.find((c) => c.id === s.order[s.i]);
    card.status = status;
    persist();
    s.tally[status]++;
    s.i++;
    s.flipped = false;
    draw();
    app.querySelector("#flip")?.focus({ preventScroll: true });
  };

  const onKey = (e) => {
    if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "ArrowRight") mark("known");
    else if (e.key === "ArrowLeft") mark("learning");
    else if ((e.key === " " || e.key === "Enter") && (e.target === document.body || e.target === app)) {
      e.preventDefault();
      flip();
    }
  };
  document.addEventListener("keydown", onKey);
  view.cleanup = () => document.removeEventListener("keydown", onKey);

  start();
}
