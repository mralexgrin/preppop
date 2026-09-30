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
  // Longer messages (usually problems) stay up long enough to read.
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), message.length > 40 ? 6000 : 3000);
}

// Screen reader announcements. The region lives outside #app, so it isn't
// replaced when a screen redraws (a live region that arrives with its text
// isn't read out).
const announcer = document.getElementById("announcer");
export function announce(text) {
  if (!announcer) return;
  announcer.textContent = "";
  setTimeout(() => (announcer.textContent = text), 50);
}

// Redraws, then puts focus back on the same control if it still exists
// (matched by id or data-* attribute), so keyboard and screen reader users
// don't get dropped at the top of the page.
export function keepFocus(redraw) {
  const active = document.activeElement;
  let selector = null;
  if (active && active !== document.body && app.contains(active)) {
    if (active.id) selector = `#${CSS.escape(active.id)}`;
    else {
      const attr = [...active.attributes].find((a) => a.name.startsWith("data-"));
      if (attr) selector = `[${attr.name}="${CSS.escape(attr.value)}"]`;
    }
  }
  redraw();
  if (selector) app.querySelector(selector)?.focus();
}

// After moving to another screen, focus its heading so the change is announced.
export function focusHeading() {
  const h1 = app.querySelector("h1");
  if (!h1) return;
  h1.setAttribute("tabindex", "-1");
  h1.focus({ preventScroll: true });
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
      ${[...MODE_TABS, ...(deck.ordered ? [["steps", "Steps"]] : [])].map(([mode, label]) => `<a href="#/deck/${deck.id}/${mode}" ${mode === active ? 'aria-current="page"' : ""}>${label}</a>`).join("")}
    </nav>`;
}

// Saves a text file: the share sheet on phones (AirDrop, Files, Messages),
// a normal download elsewhere. Resolves false if the student cancels.
export async function saveFile(name, text, type = "application/json") {
  const file = new File([text], name, { type });
  const touch = matchMedia("(hover: none)").matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return true;
    } catch (err) {
      if (err?.name === "AbortError") return false;
      // Fall through to a download if sharing isn't allowed here.
    }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// Install-to-home-screen state, filled in by app.js.
export const install = { prompt: null };
export const isInstalled = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// "Test today", "Test tomorrow", "Test in 3 days", or "Test Fri, Oct 9".
export function examLabel(examDate, today) {
  const [y, m, d] = examDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const days = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
  if (days < 0) return "";
  if (days === 0) return "Test today";
  if (days === 1) return "Test tomorrow";
  if (days <= 7) return `Test in ${days} days`;
  return `Test ${new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`;
}
