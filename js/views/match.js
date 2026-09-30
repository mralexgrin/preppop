// Match: a quick game. Tap a term, then its definition. Pairs disappear;
// a wrong pair costs a second. It's a warm-up, so it doesn't change the
// review schedule or count toward the daily goal.

import { state, persist } from "../store.js";
import { esc, shuffle } from "../util.js";
import { app, setTitle, view, deckHeader } from "../ui.js";

export const PAIRS = 6;
const PENALTY_MS = 1000;

const fmt = (ms) => `${(ms / 1000).toFixed(1)}s`;

export function renderMatch(deck) {
  setTitle(`${deck.name} · Match`);
  const m = { tiles: [], selected: null, matched: new Set(), start: 0, penalty: 0, timer: null, done: false, wrong: null };

  const best = () => state.settings.matchBest?.[deck.id];

  const newRound = () => {
    clearInterval(m.timer);
    const cards = shuffle(deck.cards.filter((c) => c.term.trim() && c.definition.trim())).slice(0, PAIRS);
    m.tiles = shuffle(cards.flatMap((c) => [
      { key: `${c.id}:t`, card: c.id, text: c.term, side: "term" },
      { key: `${c.id}:d`, card: c.id, text: c.definition, side: "definition" },
    ]));
    m.selected = null;
    m.matched = new Set();
    m.penalty = 0;
    m.done = false;
    m.start = 0;
    draw();
  };

  const elapsed = () => (m.start ? Date.now() - m.start + m.penalty : 0);

  const draw = () => {
    if (deck.cards.length < 2) {
      app.innerHTML = `${deckHeader(deck, "match")}
        <div class="result"><p class="sub">Match needs at least 2 cards.</p>
        <div class="actions"><a class="btn btn-primary" href="#/deck/${deck.id}/edit">Add cards</a></div></div>`;
      return;
    }
    if (m.done) {
      const time = elapsed();
      const record = best();
      app.innerHTML = `${deckHeader(deck, "match")}
        <section class="result">
          <h2 class="big">${fmt(time)}</h2>
          <p class="sub">${record === time ? "New best time!" : record ? `Your best: ${fmt(record)}` : ""}</p>
          <div class="actions">
            <button class="btn btn-primary" type="button" id="again">Play again</button>
            <a class="btn btn-soft" href="#/deck/${deck.id}/study">Study flashcards</a>
          </div>
        </section>`;
      app.querySelector("#again").addEventListener("click", newRound);
      return;
    }
    app.innerHTML = `${deckHeader(deck, "match")}
      <div class="match-bar">
        <p class="match-help">Tap a term, then its definition.</p>
        <p class="match-time" aria-live="off"><span id="match-clock">${fmt(elapsed())}</span>${best() ? ` · best ${fmt(best())}` : ""}</p>
      </div>
      <p class="visually-hidden" id="match-live" aria-live="polite"></p>
      <div class="match-grid">
        ${m.tiles
          .map((t) => {
            if (m.matched.has(t.card)) return `<span class="match-tile gone" aria-hidden="true"></span>`;
            const selected = m.selected === t.key;
            const wrong = m.wrong?.includes(t.key);
            return `<button type="button" class="match-tile ${t.side} ${selected ? "selected" : ""} ${wrong ? "wrong" : ""}" data-key="${t.key}" aria-pressed="${selected}">${esc(t.text)}</button>`;
          })
          .join("")}
      </div>`;
    app.querySelectorAll(".match-tile[data-key]").forEach((b) => b.addEventListener("click", () => tap(b.dataset.key)));
  };

  const announce = (text) => {
    const live = app.querySelector("#match-live");
    if (live) live.textContent = text;
  };

  const tap = (key) => {
    if (!m.start) {
      m.start = Date.now();
      m.timer = setInterval(() => {
        const clock = app.querySelector("#match-clock");
        if (clock) clock.textContent = fmt(elapsed());
      }, 100);
    }
    const tile = m.tiles.find((t) => t.key === key);
    m.wrong = null;
    if (!m.selected || m.selected === key) {
      m.selected = m.selected === key ? null : key;
      draw();
      app.querySelector(`[data-key="${key}"]`)?.focus();
      return;
    }
    const first = m.tiles.find((t) => t.key === m.selected);
    m.selected = null;
    if (first.card === tile.card && first.side !== tile.side) {
      m.matched.add(tile.card);
      announce(`Matched ${first.side === "term" ? first.text : tile.text}. ${m.tiles.length / 2 - m.matched.size} left.`);
      if (m.matched.size === m.tiles.length / 2) return finish();
    } else {
      m.penalty += PENALTY_MS;
      m.wrong = [first.key, key];
      announce("Not a match. Plus one second.");
    }
    draw();
    const next = app.querySelector(".match-tile[data-key]");
    next?.focus();
  };

  const finish = () => {
    clearInterval(m.timer);
    const time = elapsed();
    m.done = true;
    const record = best();
    if (!record || time < record) {
      state.settings.matchBest = { ...(state.settings.matchBest ?? {}), [deck.id]: time };
      persist();
    }
    draw();
  };

  view.cleanup = () => clearInterval(m.timer);
  newRound();
}
