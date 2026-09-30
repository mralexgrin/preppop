import { state, persist, dailyGoal, shortcutsOn } from "../store.js";
import { esc, plural } from "../util.js";
import { app, toast, setTitle, saveFile, install, isInstalled, isIOS, keepFocus } from "../ui.js";
import { MODEL_LABEL } from "../ai.js";
import { makeBackup, readFile, mergeDecks, mergeActivity, imageIds } from "../backup.js";
import { exportImages, importImages } from "../images.js";
import { dayKey, addDays } from "../srs.js";
import { reminderIcs } from "../reminder.js";
import { syncStatus, syncNow, enableSync, connectSync, disableSync } from "../cloud.js";

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
    <header class="page-head"><div><h1>Settings</h1><p class="lede"><a href="#/help">How PrepPop works</a></p></div></header>

    <section class="panel" aria-labelledby="goal-heading">
      <h2 id="goal-heading">Daily goal</h2>
      <p>How many cards you want to practice each day. Every answer in Flashcards, Review, Write, and Test counts.</p>
      <div class="seg" role="group" aria-label="Cards per day">
        ${GOALS.map((g) => `<button type="button" data-goal="${g}" aria-pressed="${g === goal}">${g} cards</button>`).join("")}
      </div>
    </section>

    <section class="panel" aria-labelledby="reminder-heading">
      <h2 id="reminder-heading">Daily reminder</h2>
      <p>Add a daily "Study with PrepPop" event to your phone's calendar, so it reminds you at the same time every day.</p>
      <div class="row">
        <label class="inline-field">Remind me at
          <input class="input select" type="time" id="reminder-time" value="${esc(state.settings.reminderTime ?? "19:00")}">
        </label>
        <button class="btn btn-soft" type="button" id="reminder-add">Add to my calendar</button>
      </div>
      <p class="hint">Opens a calendar file. Tap <strong>Add</strong> (iPhone) or open it with your calendar app. To stop, delete the event in your calendar.</p>
    </section>

    <section class="panel" aria-labelledby="sync-heading" id="sync-panel">
      ${syncHTML()}
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

    <section class="panel" aria-labelledby="install-heading">
      <h2 id="install-heading">${isInstalled() ? "PrepPop is on your home screen" : "Put PrepPop on your home screen"}</h2>
      ${installHTML()}
    </section>

    <section class="panel" aria-labelledby="keys-heading">
      <h2 id="keys-heading">Keyboard shortcuts</h2>
      <p>On a computer: arrow keys mark flashcards, 1–4 and T/F answer test questions, Space flips a card. Turn these off if you use a screen reader or voice control and they get in the way.</p>
      <label class="check"><input type="checkbox" id="shortcuts" ${shortcutsOn() ? "checked" : ""}> Use keyboard shortcuts</label>
    </section>

    <section class="panel" aria-labelledby="ai-heading">
      <h2 id="ai-heading">AI answers</h2>
      <p>In Test mode, ${MODEL_LABEL} writes the wrong answers. They're saved so repeat tests are instant. ${plural(cached, "question")} saved.</p>
      <div class="row"><button class="btn btn-ghost" type="button" id="clear-cache" ${cached ? "" : "disabled"}>Clear saved AI answers</button></div>
    </section>`;

  bindSync();

  app.querySelector("#reminder-add").addEventListener("click", async () => {
    const time = app.querySelector("#reminder-time").value || "19:00";
    state.settings.reminderTime = time;
    persist();
    // Start tomorrow if today's time has already passed.
    const [h, m] = time.split(":").map(Number);
    const now = new Date();
    const passed = now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
    const start = passed ? addDays(dayKey(), 1) : dayKey();
    const saved = await saveFile("preppop-reminder.ics", reminderIcs(time, start), "text/calendar", { share: false });
    if (saved) toast("Open the file to add the reminder to your calendar");
  });

  app.querySelector("#shortcuts").addEventListener("change", (e) => {
    state.settings.shortcuts = e.target.checked;
    persist();
    toast(e.target.checked ? "Keyboard shortcuts on" : "Keyboard shortcuts off");
  });

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
      keepFocus(renderSettings);
    }),
  );

  app.querySelector("#download").addEventListener("click", async () => {
    const today = dayKey();
    const backup = { ...makeBackup(state), images: await exportImages(imageIds(state.decks)).catch(() => ({})) };
    const saved = await saveFile(`preppop-backup-${today}.json`, JSON.stringify(backup, null, 1));
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
  const commit = async (change, message) => {
    try {
      await importImages(data.images);
    } catch {
      toast("Couldn't import the pictures in that file; the cards are coming in without them.");
    }
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
  // Restored decks count as just edited, so sync keeps them instead of an
  // older cloud copy (or an earlier deletion).
  const freshen = (decks) => {
    const now = Date.now();
    state.deletedDecks = { ...state.deletedDecks };
    for (const deck of decks) {
      deck.updatedAt = now;
      delete state.deletedDecks[deck.id];
    }
  };
  panel.querySelector("#add-decks").addEventListener("click", () => {
    const { decks, added, skipped } = mergeDecks(state.decks, data.decks);
    commit(() => {
      freshen(decks.filter((d) => !state.decks.includes(d)));
      state.decks = decks;
      if (isBackup) state.activity = mergeActivity(state.activity, data.activity);
    }, `Added ${plural(added, "deck")}${skipped ? `, ${skipped} already here` : ""}`);
  });
  panel.querySelector("#replace-all")?.addEventListener("click", () => {
    if (!confirm("Replace all your decks and progress with this backup? What's here now will be gone.")) return;
    commit(() => {
      // Decks not in the backup are deleted everywhere, not brought back by sync.
      const keep = new Set(data.decks.map((d) => d.id));
      const now = Date.now();
      state.deletedDecks = { ...state.deletedDecks };
      for (const deck of state.decks) if (!keep.has(deck.id)) state.deletedDecks[deck.id] = now;
      freshen(data.decks);
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

// ---------- Sync across devices ----------

const sentence = (text) => (text ? `${text[0].toUpperCase()}${text.slice(1)}${/[.!?]$/.test(text) ? "" : "."}` : "");

const ago = (ms) => {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  return new Date(ms).toLocaleDateString();
};

const PRIVACY = `<p class="hint">Your decks are encrypted on this device before they're uploaded, so PrepPop's server can't read them. There's no account, email, or password: the sync key is the only way in. Keep it somewhere safe, and only share it with your own devices. A cloud copy that isn't used for 12 months is deleted.</p>`;

function syncHTML(revealKey = false) {
  if (!state.sync) {
    return `
      <h2 id="sync-heading">Sync across devices</h2>
      <p>Keep your decks and progress the same on your phone, laptop, or a school computer, and safe if you lose one.</p>
      <div class="row">
        <button class="btn btn-primary" type="button" id="sync-on">Turn on sync</button>
      </div>
      <details class="sync-connect">
        <summary>I already have a sync key</summary>
        <form class="row" id="sync-connect-form">
          <label class="visually-hidden" for="sync-key-input">Sync key</label>
          <input class="input sync-key-input" id="sync-key-input" placeholder="ABCDE-12345-FGHJK-67890-MNPQR" autocomplete="off" autocapitalize="characters" spellcheck="false">
          <button class="btn btn-soft" type="submit">Connect</button>
        </form>
      </details>
      <p class="form-error" id="sync-error" role="alert" ${syncStatus.error ? "" : "hidden"}>${esc(sentence(syncStatus.error))}</p>
      ${PRIVACY}`;
  }
  const line = syncStatus.busy
    ? "Syncing…"
    : syncStatus.error
      ? `Couldn't sync: ${esc(syncStatus.error)}.`
      : state.sync.lastSync
        ? `Synced ${ago(state.sync.lastSync)}.`
        : "Not synced yet.";
  return `
    <h2 id="sync-heading">Sync is on</h2>
    <p class="sync-status ${syncStatus.error ? "bad" : "good"}" aria-live="polite">${line}</p>
    ${
      revealKey
        ? `<div class="sync-key-box"><p class="field-label">Your sync key</p><p class="sync-key" id="sync-key">${esc(state.sync.key)}</p>
            <div class="row"><button class="btn btn-soft" type="button" id="sync-copy">Copy key</button></div>
            <p class="hint">On your other device, open PrepPop → Settings → Sync across devices → <strong>I already have a sync key</strong>.</p></div>`
        : ""
    }
    <div class="row">
      <button class="btn btn-primary" type="button" id="sync-now" ${syncStatus.busy ? "disabled" : ""}>Sync now</button>
      ${revealKey ? "" : `<button class="btn btn-soft" type="button" id="sync-show">Show sync key</button>`}
      <button class="btn btn-ghost" type="button" id="sync-off">Turn off</button>
    </div>
    ${PRIVACY}`;
}

function bindSync(revealKey = false) {
  const panel = app.querySelector("#sync-panel");
  if (!panel) return;
  const redraw = (reveal = revealKey) => {
    if (!panel.isConnected) return;
    panel.innerHTML = syncHTML(reveal);
    bindSync(reveal);
  };
  panel.querySelector("#sync-on")?.addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    e.currentTarget.textContent = "Turning on…";
    await enableSync();
    toast(syncStatus.error ? "Sync is on, but the first upload didn't work yet" : "Sync is on");
    redraw(true);
    panel.querySelector("#sync-key")?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
  panel.querySelector("#sync-connect-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = e.currentTarget.querySelector("button");
    button.disabled = true;
    button.textContent = "Connecting…";
    const problem = await connectSync(panel.querySelector("#sync-key-input").value);
    if (problem) {
      button.disabled = false;
      button.textContent = "Connect";
      const err = panel.querySelector("#sync-error");
      err.textContent = problem;
      err.hidden = false;
      return;
    }
    toast("Connected. Your decks are synced.");
    redraw(false);
  });
  panel.querySelector("#sync-now")?.addEventListener("click", async () => {
    const pending = syncNow();
    redraw();
    await pending;
    toast(syncStatus.error ? "Couldn't sync" : "Synced");
    redraw();
    panel.querySelector("#sync-now")?.focus();
  });
  panel.querySelector("#sync-show")?.addEventListener("click", () => redraw(true));
  panel.querySelector("#sync-copy")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(state.sync.key);
      toast("Sync key copied");
    } catch {
      toast("Couldn't copy. Select the key and copy it yourself.");
    }
  });
  panel.querySelector("#sync-off")?.addEventListener("click", async () => {
    if (!confirm("Turn off sync on this device? Your decks stay here. You can turn it back on with your sync key.")) return;
    const erase = confirm("Also erase the cloud copy? Only do this if you don't use PrepPop sync on any other device.\n\nOK = erase it, Cancel = keep it");
    const problem = await disableSync({ eraseCloud: erase });
    toast(problem ?? (erase ? "Sync off and cloud copy erased" : "Sync is off on this device"));
    redraw(false);
  });
}
