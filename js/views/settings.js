import { state, persist, dailyGoal } from "../store.js";
import { esc, plural } from "../util.js";
import { app, toast, setTitle, saveFile, install, isInstalled, isIOS } from "../ui.js";
import { MODEL_LABEL } from "../ai.js";
import { makeBackup, readFile, mergeDecks, mergeActivity } from "../backup.js";
import { dayKey } from "../srs.js";

const GOALS = [10, 20, 30, 50];

const formatDay = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? key : date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
};

export function renderSettings() {
  setTitle("Settings");
  const cached = Object.keys(state.distractors).length;
  const cards = state.decks.reduce((n, d) => n + d.cards.length, 0);
  const lastBackup = state.settings.lastBackup;
  const goal = dailyGoal();

  app.innerHTML = `
    <header class="page-head"><div><h1>Settings</h1></div></header>

    <section class="panel" aria-labelledby="install-heading">
      <h2 id="install-heading">${isInstalled() ? "PrepPop is on your home screen" : "Put PrepPop on your home screen"}</h2>
      ${installHTML()}
    </section>

    <section class="panel" aria-labelledby="goal-heading">
      <h2 id="goal-heading">Daily goal</h2>
      <p>How many cards you want to practice each day. Every answer in Flashcards, Review, Write, and Test counts.</p>
      <div class="seg" role="group" aria-label="Cards per day">
        ${GOALS.map((g) => `<button type="button" data-goal="${g}" aria-pressed="${g === goal}">${g} cards</button>`).join("")}
      </div>
    </section>

    <section class="panel" aria-labelledby="backup-heading">
      <h2 id="backup-heading">Backup</h2>
      <p>Your ${plural(state.decks.length, "deck")} and ${plural(cards, "card")} are saved in this browser only. Clearing Safari or Chrome data, or losing your phone, erases them. Download a backup now and then, and keep it somewhere safe like iCloud Drive or Google Drive.</p>
      <p class="hint">${lastBackup ? `Last backup: ${esc(formatDay(lastBackup))}.` : "You haven't made a backup yet."}</p>
      <div class="row">
        <button class="btn btn-primary" type="button" id="download" ${state.decks.length ? "" : "disabled"}>Download backup</button>
        <label class="btn btn-soft file-btn">Restore or import a file<input type="file" id="restore" accept=".json,application/json"></label>
      </div>
      <div id="restore-panel" hidden></div>
    </section>

    <section class="panel" aria-labelledby="ai-heading">
      <h2 id="ai-heading">AI answers</h2>
      <p>In Test mode, ${MODEL_LABEL} writes the wrong answers. They're saved so repeat tests are instant. ${plural(cached, "question")} saved.</p>
      <div class="row"><button class="btn btn-ghost" type="button" id="clear-cache" ${cached ? "" : "disabled"}>Clear saved AI answers</button></div>
    </section>`;

  app.querySelector("#install")?.addEventListener("click", async () => {
    const prompt = install.prompt;
    if (!prompt) return;
    install.prompt = null;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") toast("PrepPop installed");
    renderSettings();
  });

  app.querySelectorAll("[data-goal]").forEach((b) =>
    b.addEventListener("click", () => {
      state.settings.dailyGoal = Number(b.dataset.goal);
      persist();
      toast(`Daily goal: ${b.dataset.goal} cards`);
      renderSettings();
    }),
  );

  app.querySelector("#download").addEventListener("click", async () => {
    const today = dayKey();
    const saved = await saveFile(`preppop-backup-${today}.json`, JSON.stringify(makeBackup(state), null, 1));
    if (!saved) return;
    state.settings.lastBackup = today;
    persist();
    toast("Backup saved");
    renderSettings();
  });

  app.querySelector("#restore").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return toast("That file is too big to be a PrepPop backup.");
    let data;
    try {
      data = readFile(await file.text());
    } catch (err) {
      return toast(err.message);
    }
    showRestore(data);
  });

  app.querySelector("#clear-cache").addEventListener("click", () => {
    state.distractors = {};
    persist();
    toast("Saved AI answers cleared");
    renderSettings();
  });
}

function showRestore(data) {
  const panel = app.querySelector("#restore-panel");
  const cardCount = data.decks.reduce((n, d) => n + d.cards.length, 0);
  const when = data.createdAt ? new Date(data.createdAt).toLocaleDateString() : "";
  const isBackup = data.kind === "backup";
  panel.hidden = false;
  panel.innerHTML = `
    <div class="restore-box" role="region" aria-labelledby="restore-heading">
      <h3 id="restore-heading">${isBackup ? "Backup" : "Shared deck"}${when ? ` from ${esc(when)}` : ""}</h3>
      <p>${isBackup ? plural(data.decks.length, "deck") + ", " : `“${esc(data.decks[0].name)}”, `}${plural(cardCount, "card")}.</p>
      <div class="row">
        <button class="btn btn-primary" type="button" id="add-decks">${isBackup ? "Add decks I don't have" : "Add this deck"}</button>
        ${isBackup ? `<button class="btn btn-danger" type="button" id="replace-all">Replace everything</button>` : ""}
        <button class="btn btn-ghost" type="button" id="cancel-restore">Cancel</button>
      </div>
      ${isBackup ? `<p class="hint">"Add" keeps everything you have now. "Replace" swaps all your decks and progress for the backup.</p>` : ""}
    </div>`;
  panel.querySelector("#add-decks").focus();

  panel.querySelector("#cancel-restore").addEventListener("click", () => {
    panel.hidden = true;
    panel.innerHTML = "";
  });
  // Only report success if it actually saved; otherwise put things back.
  const commit = (change, message) => {
    const before = { decks: state.decks, activity: state.activity, settings: state.settings };
    change();
    if (!persist()) {
      Object.assign(state, before);
      toast("Couldn't import: this browser is out of storage space.");
      return;
    }
    toast(message);
    location.hash = "#/";
  };
  panel.querySelector("#add-decks").addEventListener("click", () => {
    const { decks, added, skipped } = mergeDecks(state.decks, data.decks);
    commit(() => {
      state.decks = decks;
      if (isBackup) state.activity = mergeActivity(state.activity, data.activity);
    }, `Added ${plural(added, "deck")}${skipped ? `, ${skipped} already here` : ""}`);
  });
  panel.querySelector("#replace-all")?.addEventListener("click", () => {
    if (!confirm("Replace all your decks and progress with this backup? What's here now will be gone.")) return;
    commit(() => {
      state.decks = data.decks;
      state.activity = data.activity;
      state.settings = { ...state.settings, ...data.settings };
    }, "Backup restored");
  });
}

function installHTML() {
  if (isInstalled()) return "<p>It opens full screen and works without a connection. AI answers in Test mode still need internet.</p>";
  const why = "<p>It opens like an app, full screen, and works without a connection. Your cards stay on this device.</p>";
  if (install.prompt) return `${why}<div class="row"><button class="btn btn-primary" type="button" id="install">Install PrepPop</button></div>`;
  if (isIOS())
    return `${why}<ol class="steps"><li>Open PrepPop in <strong>Safari</strong>.</li><li>Tap the <strong>Share</strong> button (the square with an arrow).</li><li>Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li></ol>`;
  return `${why}<p class="hint">In your browser's menu, choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>`;
}
