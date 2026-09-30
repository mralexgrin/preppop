import { state, persist, blankCard, getDeck } from "../store.js";
import { esc, plural, uid } from "../util.js";
import { app, toast, setTitle } from "../ui.js";

export function renderLibrary() {
  setTitle();
  if (!state.decks.length) {
    app.innerHTML = `
      <section class="empty">
        <div class="empty-art" aria-hidden="true"><span></span><span></span><span>Aa</span></div>
        <h1>Make your first deck</h1>
        <p>Write a term on the front and a definition on the back. Then flip through the cards to study, or take a multiple-choice test.</p>
        <div class="actions">
          <a class="btn btn-primary btn-lg" href="#/new">Create a deck</a>
          <button class="btn btn-soft btn-lg" type="button" id="sample">Try a sample deck</button>
        </div>
      </section>`;
    app.querySelector("#sample").addEventListener("click", addSampleDeck);
    return;
  }

  const cardTotal = state.decks.reduce((n, d) => n + d.cards.length, 0);
  app.innerHTML = `
    <header class="page-head">
      <div>
        <h1>Your decks</h1>
        <p class="lede">${plural(state.decks.length, "deck")} · ${plural(cardTotal, "card")}</p>
      </div>
      <a class="btn btn-primary" href="#/new">+ New deck</a>
    </header>
    <ul class="deck-grid">${state.decks.map(deckTile).join("")}</ul>`;

  app.querySelector(".deck-grid").addEventListener("click", (e) => {
    const deck = getDeck(e.target.closest("[data-delete-deck]")?.dataset.deleteDeck);
    if (!deck || !confirm(`Delete "${deck.name}" and all of its cards? This can't be undone.`)) return;
    state.decks = state.decks.filter((d) => d !== deck);
    persist();
    renderLibrary();
    toast("Deck deleted");
  });
}

function deckTile(deck) {
  const total = deck.cards.length;
  const known = deck.cards.filter((c) => c.status === "known").length;
  const learning = deck.cards.filter((c) => c.status === "learning").length;
  const pct = (n) => (total ? (n / total) * 100 : 0);
  return `
    <li class="deck-tile">
      <div>
        <h2>${esc(deck.name)}</h2>
        <p class="meta">${plural(total, "card")}</p>
      </div>
      <div class="meter" role="img" aria-label="${known} of ${total} known, ${learning} still learning">
        <span class="m-know" style="width:${pct(known)}%"></span>
        <span class="m-learn" style="width:${pct(learning)}%"></span>
      </div>
      <p class="legend">
        <span><span class="dot know"></span>${known} known</span>
        <span><span class="dot learn"></span>${learning} still learning</span>
      </p>
      <div class="deck-actions">
        <a class="btn btn-soft" href="#/deck/${deck.id}/study">Flashcards</a>
        <a class="btn btn-soft" href="#/deck/${deck.id}/test">Test</a>
        <a class="btn btn-ghost" href="#/deck/${deck.id}/edit" aria-label="Edit ${esc(deck.name)}">Edit</a>
        <button class="btn btn-danger" type="button" data-delete-deck="${deck.id}" aria-label="Delete ${esc(deck.name)}">Delete</button>
      </div>
    </li>`;
}

function addSampleDeck() {
  const cards = [
    ["Mercury", "Smallest planet and the closest to the Sun"],
    ["Venus", "Hottest planet, wrapped in thick carbon dioxide clouds"],
    ["Mars", "The red planet, home to Olympus Mons"],
    ["Jupiter", "Largest planet, known for its Great Red Spot storm"],
    ["Saturn", "Gas giant with the most prominent ring system"],
    ["Neptune", "Farthest planet from the Sun, with the fastest winds"],
    ["Asteroid belt", "Ring of rocky bodies orbiting between Mars and Jupiter"],
    ["Light-year", "Distance light travels in one year, about 9.46 trillion km"],
  ].map(([term, definition]) => ({ ...blankCard(), term, definition }));
  state.decks.push({ id: uid(), name: "Solar System basics", createdAt: Date.now(), cards });
  persist();
  renderLibrary();
  toast("Sample deck added");
}
