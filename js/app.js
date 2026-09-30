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
import { renderProgress } from "./views/progress.js";
import { renderSteps } from "./views/steps.js";
import { renderHelp } from "./views/help.js";
import { syncNow, pushChanges, syncStatus } from "./cloud.js";

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

  const [page, id, mode, option] = currentHash.replace(/^#\/?/, "").split("/");
  const section = ["settings", "review", "new", "progress"].includes(page) ? page : "decks";
  document.querySelectorAll("[data-nav]").forEach((a) => {
    a.dataset.nav === section ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current");
  });
  const due = dueCards(state.decks, dayKey()).length;
  document.querySelectorAll("[data-due-badge]").forEach((badge) => {
    badge.hidden = !due;
    badge.textContent = due > 99 ? "99+" : due;
    badge.setAttribute("aria-label", `${due} due`);
  });

  // Screens that don't hold on to a deck can take merged data from other devices.
  if (["", "progress", "settings"].includes(page ?? "")) maybeSync();

  if (page === "new") return renderEditor(null);
  if (page === "settings") return renderSettings();
  if (page === "review") return renderReview();
  if (page === "starters") return renderStarters();
  if (page === "progress") return renderProgress();
  if (page === "help") return renderHelp();
  const deck = page === "deck" && getDeck(id);
  if (deck && mode === "edit") return renderEditor(deck);
  if (deck && mode === "study") return renderStudy(deck, { cram: option === "cram" });
  if (deck && mode === "test") return renderTest(deck);
  if (deck && mode === "write") return renderWrite(deck);
  if (deck && mode === "steps") return renderSteps(deck);
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

// ---------- Sync across devices (see js/cloud.js) ----------

let pushTimer;
hooks.onChange = () => {
  if (!state.sync) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushChanges, 10_000);
};

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && state.sync && pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
    pushChanges();
  }
});

async function maybeSync() {
  if (!state.sync || syncStatus.busy) return;
  const stale = !state.sync.lastSync || Date.now() - state.sync.lastSync > 60_000;
  if (!stale && !syncStatus.needsMerge) return;
  const hashAtStart = location.hash;
  const changed = await syncNow();
  // Redraw only if the data changed and she's still on the same screen.
  if (changed && location.hash === hashAtStart && !view.leaveGuard) route();
}
