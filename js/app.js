import { load, getDeck, hooks, state } from "./store.js";
import { dueCards, dayKey } from "./srs.js";
import { isTyping } from "./util.js";
import { toast, view, install } from "./ui.js";
import { renderLibrary } from "./views/library.js";
import { renderEditor } from "./views/editor.js";
import { renderStudy } from "./views/study.js";
import { renderTest } from "./views/test.js";
import { renderSettings } from "./views/settings.js";
import { renderReview } from "./views/review.js";
import { renderWrite } from "./views/write.js";
import { renderStarters } from "./views/starters.js";

hooks.onPersistError = () => toast("Couldn't save. Browser storage is full or blocked.");
load();

let currentHash = location.hash || "#/";

window.addEventListener("hashchange", () => {
  if (view.leaveGuard && !view.leaveGuard()) {
    history.replaceState(null, "", currentHash);
    return;
  }
  route();

// Offline support. Skipped on localhost so edits show up immediately while
// developing; add ?sw to the URL to test it locally.
const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
if ("serviceWorker" in navigator && (!isLocal || new URLSearchParams(location.search).has("sw"))) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// Chrome/Android offer an install prompt; keep it for the Settings button.
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  install.prompt = e;
});
});

function route() {
  view.cleanup?.();
  view.cleanup = null;
  view.leaveGuard = null;
  currentHash = location.hash || "#/";
  window.scrollTo(0, 0);

  const [page, id, mode] = currentHash.replace(/^#\/?/, "").split("/");
  const section = ["settings", "review", "new"].includes(page) ? page : "decks";
  document.querySelectorAll("[data-nav]").forEach((a) => {
    a.dataset.nav === section ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current");
  });
  const due = dueCards(state.decks, dayKey()).length;
  document.querySelectorAll("[data-due-badge]").forEach((badge) => {
    badge.hidden = !due;
    badge.textContent = due > 99 ? "99+" : due;
    badge.setAttribute("aria-label", `${due} due`);
  });

  if (page === "new") return renderEditor(null);
  if (page === "settings") return renderSettings();
  if (page === "review") return renderReview();
  if (page === "starters") return renderStarters();
  const deck = page === "deck" && getDeck(id);
  if (deck && mode === "edit") return renderEditor(deck);
  if (deck && mode === "study") return renderStudy(deck);
  if (deck && mode === "test") return renderTest(deck);
  if (deck && mode === "write") return renderWrite(deck);
  renderLibrary();
}

route();

// Offline support. Skipped on localhost so edits show up immediately while
// developing; add ?sw to the URL to test it locally.
const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
if ("serviceWorker" in navigator && (!isLocal || new URLSearchParams(location.search).has("sw"))) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// Chrome/Android offer an install prompt; keep it for the Settings button.
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  install.prompt = e;
});

// Hide the phone tab bar while typing so it never covers the keyboard.
document.addEventListener("focusin", (e) => document.body.classList.toggle("typing", Boolean(isTyping(e.target))));
document.addEventListener("focusout", () => document.body.classList.remove("typing"));
