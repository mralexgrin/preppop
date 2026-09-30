import { esc } from "./util.js";

// DOM helpers shared by views, plus the router's per-view hooks.

export const app = document.getElementById("app");
const toastEl = document.getElementById("toast");

// A view sets these; the router runs cleanup and checks leaveGuard on navigation.
export const view = { cleanup: null, leaveGuard: null };

let toastTimer;
export function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
}

export function setTitle(title) {
  document.title = title ? `${title} · PrepPop` : "PrepPop";
}

export function statusChip(status) {
  if (status === "known") return `<span class="chip know">Known</span>`;
  if (status === "learning") return `<span class="chip learn">Still learning</span>`;
  return `<span class="chip new">New</span>`;
}

const MODE_TABS = [
  ["study", "Flashcards"],
  ["write", "Write"],
  ["test", "Test"],
];

// Deck name plus the Flashcards · Write · Test tabs shared by every study mode.
export function deckHeader(deck, active, right = "") {
  return `
    <header class="page-head deck-head">
      <div>
        <a class="back" href="#/">← Decks</a>
        <h1>${esc(deck.name)}</h1>
      </div>
      ${right}
    </header>
    <nav class="mode-tabs" aria-label="Study modes" data-subject="${deck.subject}">
      ${MODE_TABS.map(([mode, label]) => `<a href="#/deck/${deck.id}/${mode}" ${mode === active ? 'aria-current="page"' : ""}>${label}</a>`).join("")}
    </nav>`;
}
