import { state, persist, blankCard, getDeck, dailyGoal } from "../store.js";
import { dueCards, isDue, isNew, streak, dayKey } from "../srs.js";
import { esc, plural, uid } from "../util.js";
import { app, toast, setTitle, view } from "../ui.js";
import { SUBJECTS } from "../subjects.js";

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
    ${todayPanel()}
    ${SUBJECTS.map((subject) => {
      const decks = state.decks.filter((d) => d.subject === subject.id);
      if (!decks.length) return "";
      return `
        <section class="subject-group" data-subject="${subject.id}" aria-labelledby="group-${subject.id}">
          <h2 class="group-head" id="group-${subject.id}"><span class="subject-dot" aria-hidden="true"></span>${subject.name}<span class="group-count">${plural(decks.length, "deck")}</span></h2>
          <ul class="deck-grid">${decks.map(deckTile).join("")}</ul>
        </section>`;
    }).join("")}`;

  app.addEventListener("click", onLibraryClick);
  view.cleanup = () => app.removeEventListener("click", onLibraryClick);
}

function onLibraryClick(e) {
  const deck = getDeck(e.target.closest("[data-delete-deck]")?.dataset.deleteDeck);
  if (!deck || !confirm(`Delete "${deck.name}" and all of its cards? This can't be undone.`)) return;
  state.decks = state.decks.filter((d) => d !== deck);
  persist();
  renderLibrary();
  toast("Deck deleted");
}

const FLAME = `<svg class="flame" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 3.5-1.2 5.3-2.6 7C8 10.8 7 12.4 7 14.5A5 5 0 0 0 12 20a5 5 0 0 0 5-5.3c0-2.2-1.2-3.6-2.1-4.6-.3 1.4-1 2.3-2 2.8.6-3.5-.2-7.4-.9-10.9Z" fill="currentColor"/></svg>`;

function todayPanel() {
  const today = dayKey();
  const due = dueCards(state.decks, today).length;
  const days = streak(state.activity, today);
  const done = state.activity[today]?.answered ?? 0;
  const goal = dailyGoal();
  const learnDeck = [...state.decks]
    .map((d) => ({ d, fresh: d.cards.filter(isNew).length }))
    .filter((x) => x.fresh)
    .sort((a, b) => b.fresh - a.fresh)[0];

  let line;
  let action;
  if (due) {
    line = `<strong>${plural(due, "card")}</strong> ready to review`;
    action = `<a class="btn btn-primary" href="#/review">Start review</a>`;
  } else if (learnDeck) {
    line = done ? "Reviews done for now. Learn some new cards?" : "Nothing to review yet. Start by learning some cards.";
    action = `<a class="btn btn-soft" href="#/deck/${learnDeck.d.id}/study">Learn ${esc(learnDeck.d.name)} · ${learnDeck.fresh} new</a>`;
  } else {
    line = "All caught up. Nice work.";
    action = "";
  }

  return `
    <section class="today" aria-labelledby="today-heading">
      <div class="today-top">
        <h2 id="today-heading">Today</h2>
        <p class="streak ${days ? "on" : ""}">${FLAME}<span>${days ? `<strong>${days}</strong>-day streak` : "No streak yet"}</span></p>
      </div>
      <p class="today-line">${line}</p>
      <div class="goal" role="img" aria-label="${Math.min(done, goal)} of ${goal} cards practiced today">
        <div class="goal-track"><span style="width:${Math.min(100, (done / goal) * 100)}%"></span></div>
        <span class="goal-label">${done >= goal ? "Daily goal done" : `${done} / ${goal} today`}</span>
      </div>
      ${action ? `<div class="today-action">${action}</div>` : ""}
    </section>`;
}

function deckTile(deck) {
  const total = deck.cards.length;
  const due = deck.cards.filter((c) => isDue(c, dayKey())).length;
  const known = deck.cards.filter((c) => c.status === "known").length;
  const learning = deck.cards.filter((c) => c.status === "learning").length;
  const pct = (n) => (total ? (n / total) * 100 : 0);
  return `
    <li class="deck-tile" data-subject="${deck.subject}">
      <div class="tile-head">
        <div>
          <h3>${esc(deck.name)}</h3>
          <p class="meta">${plural(total, "card")}${due ? ` · <span class="due">${due} due</span>` : ""}</p>
        </div>
        <div class="tile-tools">
          <a class="text-btn" href="#/deck/${deck.id}/edit" aria-label="Edit ${esc(deck.name)}">Edit</a>
          <button class="text-btn danger" type="button" data-delete-deck="${deck.id}" aria-label="Delete ${esc(deck.name)}">Delete</button>
        </div>
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
  state.decks.push({ id: uid(), name: "Solar System basics", subject: "other", createdAt: Date.now(), cards });
  persist();
  renderLibrary();
  toast("Sample deck added");
}
