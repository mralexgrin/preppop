import { load, getDeck, hooks } from "./store.js";
import { toast, view } from "./ui.js";
import { renderLibrary } from "./views/library.js";
import { renderEditor } from "./views/editor.js";
import { renderStudy } from "./views/study.js";
import { renderTest } from "./views/test.js";
import { renderSettings } from "./views/settings.js";

hooks.onPersistError = () => toast("Couldn't save. Browser storage is full or blocked.");
load();

let currentHash = location.hash || "#/";

window.addEventListener("hashchange", () => {
  if (view.leaveGuard && !view.leaveGuard()) {
    history.replaceState(null, "", currentHash);
    return;
  }
  route();
});

function route() {
  view.cleanup?.();
  view.cleanup = null;
  view.leaveGuard = null;
  currentHash = location.hash || "#/";
  window.scrollTo(0, 0);

  const [page, id, mode] = currentHash.replace(/^#\/?/, "").split("/");
  document.querySelectorAll("[data-nav]").forEach((a) => {
    const active = a.dataset.nav === (page === "settings" ? "settings" : "decks");
    active ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current");
  });

  if (page === "new") return renderEditor(null);
  if (page === "settings") return renderSettings();
  const deck = page === "deck" && getDeck(id);
  if (deck && mode === "edit") return renderEditor(deck);
  if (deck && mode === "study") return renderStudy(deck);
  if (deck && mode === "test") return renderTest(deck);
  renderLibrary();
}

route();
