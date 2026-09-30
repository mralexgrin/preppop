import { persist, recordAnswer, touch, forgetCards, shortcutsOn } from "../store.js";
import { esc, plural, shuffle, isTyping } from "../util.js";
import { app, toast, setTitle, statusChip, view, deckHeader, keepFocus } from "../ui.js";
import { flipCardHTML, setFlipped, attachSwipe, bindSpeak, bindHint } from "../flipcard.js";
import { hydrateImages } from "../images.js";

const SWAP_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const SHUFFLE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// cram: start on the cards she doesn't know yet (from the Today test banner).
export function renderStudy(deck, { cram = false } = {}) {
  setTitle(deck.name);
  const s = { front: "term", onlyLearning: false, order: [], i: 0, flipped: false, tally: { known: 0, learning: 0 } };
  if (cram && deck.cards.some((c) => c.status !== "known")) s.onlyLearning = true;
  const notKnown = () => deck.cards.filter((c) => c.status !== "known");

  const start = ({ shuffled = false } = {}) => {
    const pool = s.onlyLearning ? notKnown() : deck.cards;
    s.order = (shuffled ? shuffle(pool) : pool).map((c) => c.id);
    s.i = 0;
    s.flipped = false;
    s.tally = { known: 0, learning: 0 };
    draw();
  };

  const header = deckHeader(deck, "study");

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
        <div class="seg" role="group" aria-label="Which cards">
          <button type="button" data-only="all" aria-pressed="${!s.onlyLearning}">All (${deck.cards.length})</button>
          <button type="button" data-only="learning" aria-pressed="${s.onlyLearning}" ${remaining ? "" : "disabled"}>Not known yet (${remaining})</button>
        </div>
        <div class="tool-icons">
          <button class="tool-btn" type="button" id="swap-sides" aria-pressed="${s.front === "definition"}" aria-label="Show the definition first" title="Show the definition first">${SWAP_ICON}</button>
          <button class="tool-btn" type="button" id="shuffle" aria-label="Shuffle" title="Shuffle">${SHUFFLE_ICON}</button>
        </div>
      </div>`;

    if (s.i >= s.order.length) {
      app.innerHTML = `${header}${toolbar}
        <section class="result">
          <h2 class="big">Round done</h2>
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
    app.innerHTML = `${header}${toolbar}
      <div class="progress">
        <div class="progress-track"><span style="width:${(s.i / s.order.length) * 100}%"></span></div>
        <span class="progress-label">${s.i + 1} / ${s.order.length}</span>
      </div>
      ${flipCardHTML({ card, deck, front: s.front, flipped: s.flipped, topRight: statusChip(card.status) })}
      <p class="card-tools"><button class="text-btn danger" type="button" id="delete-card">Delete this card</button></p>`;

    bindToolbar();
    const flipBtn = app.querySelector("#flip");
    flipBtn.addEventListener("click", flip);
    attachSwipe(flipBtn, { onLeft: () => mark("learning"), onRight: () => mark("known") });
    bindSpeak(app, { deck, card, front: s.front, isFlipped: () => s.flipped });
    bindHint(app);
    hydrateImages(app);
    app.querySelectorAll("[data-mark]").forEach((b) => b.addEventListener("click", () => mark(b.dataset.mark)));
    app.querySelector("#delete-card").addEventListener("click", () => deleteCard(card));
  };

  const deleteCard = (card) => {
    if (!confirm(`Delete this card?\n\n${card.term}\n\nThis can't be undone.`)) return;
    deck.cards = deck.cards.filter((c) => c !== card);
    forgetCards(deck, [card.id]);
    touch(deck);
    s.order = s.order.filter((id) => id !== card.id);
    s.flipped = false;
    persist();
    draw();
    toast("Card deleted");
  };

  const bindToolbar = () => {
    app.querySelector("#swap-sides").addEventListener("click", () => {
      s.front = s.front === "term" ? "definition" : "term";
      s.flipped = false;
      keepFocus(draw);
      toast(s.front === "term" ? "Showing the term first" : "Showing the definition first");
    });
    app.querySelectorAll("[data-only]").forEach((b) =>
      b.addEventListener("click", () => {
        s.onlyLearning = b.dataset.only === "learning";
        keepFocus(() => start());
      }),
    );
    app.querySelector("#shuffle").addEventListener("click", () => {
      keepFocus(() => start({ shuffled: true }));
      toast("Cards shuffled");
    });
  };

  const flip = () => {
    if (!app.querySelector("#flip")) return;
    s.flipped = !s.flipped;
    setFlipped(app, s.flipped);
  };

  const mark = (status) => {
    if (s.i >= s.order.length) return;
    const card = deck.cards.find((c) => c.id === s.order[s.i]);
    recordAnswer(card, status === "known", undefined, deck);
    persist();
    s.tally[status]++;
    s.i++;
    s.flipped = false;
    draw();
    app.querySelector("#flip")?.focus();
  };

  const onKey = (e) => {
    if (!shortcutsOn() || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
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
