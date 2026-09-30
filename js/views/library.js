import { state, persist, getDeck, dailyGoal, deleteDeck } from "../store.js";
import { dueCards, isDue, isNew, streak, dayKey, addDays } from "../srs.js";
import { esc, plural } from "../util.js";
import { app, toast, setTitle, view, examLabel } from "../ui.js";
import { SUBJECTS } from "../subjects.js";
import { searchCards } from "../search.js";

// Kept while moving between screens, so Back returns to the same search.
let lastQuery = "";

export function renderLibrary() {
  setTitle();
  if (!state.decks.length) {
    app.innerHTML = `
      <section class="empty">
        <div class="empty-art" aria-hidden="true"><span></span><span></span><span>Aa</span></div>
        <h1>Let's set up your decks</h1>
        <p>Start with a ready-made deck for your classes (medical terms, vital signs, cell parts, Spanish, and more) or make your own. Paste a vocab list and PrepPop makes the cards.</p>
        <div class="actions">
          <a class="btn btn-primary btn-lg" href="#/starters" id="starters">Browse starter decks</a>
          <a class="btn btn-soft btn-lg" href="#/new">Make my own deck</a>
        </div>
        <p class="restore-hint">New phone? <a href="#/settings">Restore a backup</a> or open a deck a friend shared. <a href="#/help">How PrepPop works</a></p>
      </section>`;
    return;
  }

  const cardTotal = state.decks.reduce((n, d) => n + d.cards.length, 0);
  app.innerHTML = `
    <header class="page-head">
      <div>
        <h1>Your decks</h1>
        <p class="lede">${plural(state.decks.length, "deck")} · ${plural(cardTotal, "card")}</p>
      </div>
      <div class="head-actions">
        <a class="btn btn-ghost" href="#/starters">Starter decks</a>
        <a class="btn btn-primary" href="#/new">+ New deck</a>
      </div>
    </header>
    <div class="search-bar" role="search">
      <label class="visually-hidden" for="card-search">Search your cards</label>
      <input class="input search-input" id="card-search" type="search" placeholder="Search ${plural(cardTotal, "card")}" autocomplete="off" spellcheck="false" value="${esc(lastQuery)}">
    </div>
    <div id="search-results" aria-live="polite"></div>
    <div id="library-main">
    ${introTip()}
    ${todayPanel()}
    ${backupNudge(cardTotal)}
    ${SUBJECTS.map((subject) => {
      const decks = state.decks.filter((d) => d.subject === subject.id);
      if (!decks.length) return "";
      return `
        <section class="subject-group" data-subject="${subject.id}" aria-labelledby="group-${subject.id}">
          <h2 class="group-head" id="group-${subject.id}"><span class="subject-dot" aria-hidden="true"></span>${subject.name}<span class="group-count">${plural(decks.length, "deck")}</span></h2>
          <ul class="deck-grid">${decks.map(deckTile).join("")}</ul>
        </section>`;
    }).join("")}
    </div>`;

  const search = app.querySelector("#card-search");
  const showResults = () => {
    lastQuery = search.value;
    const results = app.querySelector("#search-results");
    const main = app.querySelector("#library-main");
    const q = search.value.trim();
    main.hidden = Boolean(q);
    if (!q) {
      results.innerHTML = "";
      return;
    }
    const hits = searchCards(state.decks, q);
    results.innerHTML = hits.length
      ? `<p class="search-count">${hits.length === 50 ? "First 50 matches" : `${hits.length} match${hits.length === 1 ? "" : "es"}`}</p>
         <ul class="search-hits">${hits
           .map(
             ({ deck, card }) => `
           <li data-subject="${deck.subject}">
             <a href="#/deck/${deck.id}/study">
               <strong>${esc(card.term)}</strong>
               <span>${esc(card.definition)}</span>
               <small><span class="subject-dot" aria-hidden="true"></span>${esc(deck.name)}</small>
             </a>
           </li>`,
           )
           .join("")}</ul>`
      : `<p class="search-count">No cards match "${esc(q)}".</p>`;
  };
  search.addEventListener("input", showResults);
  if (lastQuery) showResults();

  app.addEventListener("click", onLibraryClick);
  view.cleanup = () => app.removeEventListener("click", onLibraryClick);
}

function onLibraryClick(e) {
  if (e.target.closest("#intro-done")) {
    state.settings.introDone = true;
    persist();
    renderLibrary();
    return;
  }
  const deck = getDeck(e.target.closest("[data-delete-deck]")?.dataset.deleteDeck);
  if (!deck || !confirm(`Delete "${deck.name}" and all of its cards? This can't be undone.`)) return;
  deleteDeck(deck);
  persist();
  renderLibrary();
  toast("Deck deleted");
}

const FLAME = `<svg class="flame" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 3.5-1.2 5.3-2.6 7C8 10.8 7 12.4 7 14.5A5 5 0 0 0 12 20a5 5 0 0 0 5-5.3c0-2.2-1.2-3.6-2.1-4.6-.3 1.4-1 2.3-2 2.8.6-3.5-.2-7.4-.9-10.9Z" fill="currentColor"/></svg>`;

// The nearest test in the next two weeks, with a Cram button.
function examBanner(today) {
  const soon = state.decks
    .filter((d) => d.examDate && d.examDate >= today && d.examDate <= addDays(today, 14) && d.cards.length)
    .sort((a, b) => a.examDate.localeCompare(b.examDate))[0];
  if (!soon) return "";
  const left = soon.cards.filter((c) => c.status !== "known").length;
  return `
    <div class="exam-banner" data-subject="${soon.subject}">
      <p><strong>${examLabel(soon.examDate, today)}:</strong> ${esc(soon.name)}. ${left ? `${plural(left, "card")} not known yet.` : "You know every card. A quick review keeps it fresh."}</p>
      <a class="btn btn-soft" href="#/deck/${soon.id}/study/cram">Cram</a>
    </div>`;
}

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
      ${examBanner(today)}
      <div class="goal" role="img" aria-label="${Math.min(done, goal)} of ${goal} cards practiced today">
        <div class="goal-track"><span style="width:${Math.min(100, (done / goal) * 100)}%"></span></div>
        <span class="goal-label">${done >= goal ? "Daily goal done" : `${done} / ${goal} today`}</span>
      </div>
      ${action ? `<div class="today-action">${action}</div>` : ""}
    </section>`;
}

// First-run tip, until she dismisses it.
function introTip() {
  if (state.settings.introDone) return "";
  return `
    <section class="intro-tip" aria-labelledby="intro-heading">
      <h2 id="intro-heading">How PrepPop works in 30 seconds</h2>
      <ol class="steps">
        <li>Open a deck in <strong>Flashcards</strong> and mark each card <strong>I know it</strong> or <strong>Still learning</strong>.</li>
        <li>Come back each day and tap <strong>Start review</strong>. PrepPop brings cards back right before you'd forget them.</li>
        <li>Test coming up? Set the test date in the deck editor and <strong>Cram</strong>.</li>
      </ol>
      <div class="row">
        <button class="btn btn-primary" type="button" id="intro-done">Got it</button>
        <a class="btn btn-ghost" href="#/help">More help</a>
      </div>
    </section>`;
}

// Everything lives in this browser, so remind her to back up once there's
// real work to lose (20+ cards) and no backup in the last two weeks.
function backupNudge(cardTotal) {
  const last = state.settings.lastBackup;
  if (cardTotal < 20 || (last && last >= addDays(dayKey(), -14))) return "";
  return `
    <p class="notice backup-nudge">
      <span>${last ? "It's been a while since your last backup." : "Your cards are only saved in this browser."} A backup keeps your cards safe if you clear your browser or get a new phone.</span>
      <a class="btn btn-soft" href="#/settings">Back up</a>
    </p>`;
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
          ${deck.examDate && examLabel(deck.examDate, dayKey()) ? `<p class="exam-badge">${examLabel(deck.examDate, dayKey())}</p>` : ""}
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
        <a class="btn btn-soft" href="#/deck/${deck.id}/write">Write</a>
        <a class="btn btn-soft" href="#/deck/${deck.id}/test">Test</a>
      </div>
    </li>`;
}

