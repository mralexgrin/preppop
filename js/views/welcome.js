// Onboarding: who's learning (a first name or nickname and an avatar), their
// school level, and which subjects; finishes with matching starter decks.
// Also used to add another learner from the Who's learning? screen.

import { blankCard, migrate } from "../store.js";
import { esc, plural, uid } from "../util.js";
import { app, setTitle, announce } from "../ui.js";
import { SUBJECTS } from "../subjects.js";
import { LEVELS, levelOf, startersFor } from "../starters.js";
import { session, AVATARS, MAX_NAME, addProfile, saveRegistry, profileKey, refreshRegistry } from "../profiles.js";

export function renderWelcome({ adding = false } = {}) {
  setTitle(adding ? "Add a learner" : "Welcome");
  const w = { step: 1, name: "", avatar: AVATARS[0], level: null, subjects: [] };

  const header = (title, lede) => `
    <header class="page-head onboard-head">
      <div>
        ${adding ? `<a class="back" href="#/profiles">← Who's learning?</a>` : ""}
        <p class="onboard-step">Step ${w.step} of 3</p>
        <h1 tabindex="-1" id="onboard-h">${title}</h1>
        ${lede ? `<p class="lede">${lede}</p>` : ""}
      </div>
    </header>`;

  const draw = () => {
    if (w.step === 1) drawWho();
    else if (w.step === 2) drawLevel();
    else drawSubjects();
    app.querySelector("#onboard-h")?.focus();
  };

  const drawWho = () => {
    app.innerHTML = `${header(adding ? "Who's the new learner?" : "Hi! Who's learning?", adding ? "" : "PrepPop helps you remember what you study, a few minutes a day.")}
      <form class="onboard" id="who" novalidate>
        <label class="field">
          <span class="field-label">Your first name or a nickname</span>
          <input class="input" id="name" maxlength="${MAX_NAME}" autocomplete="off" autocapitalize="words" value="${esc(w.name)}" aria-describedby="name-tip">
        </label>
        <p class="hint" id="name-tip">Just for this device, so you know whose decks are whose. No email or password.</p>
        <fieldset class="avatar-pick">
          <legend class="field-label">Pick an avatar</legend>
          <div class="avatars">${AVATARS.map(
            (a, i) => `<label class="avatar-opt"><input type="radio" name="avatar" value="${a}" ${a === w.avatar ? "checked" : ""}><span aria-hidden="true">${a}</span><span class="visually-hidden">Avatar ${i + 1}</span></label>`,
          ).join("")}</div>
        </fieldset>
        <div class="row"><button class="btn btn-primary btn-lg" type="submit">Next</button></div>
      </form>`;
    const name = app.querySelector("#name");
    name.addEventListener("input", () => (w.name = name.value));
    app.querySelectorAll('input[name="avatar"]').forEach((r) => r.addEventListener("change", () => (w.avatar = r.value)));
    app.querySelector("#who").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!w.name.trim()) {
        name.focus();
        announce("Type a first name or a nickname.");
        return;
      }
      w.step = 2;
      draw();
    });
  };

  const drawLevel = () => {
    app.innerHTML = `${header(`What grade are you in${w.name.trim() ? `, ${esc(w.name.trim())}` : ""}?`, "PrepPop picks subjects and starter decks to match.")}
      <div class="level-pick" role="group" aria-label="School level">${LEVELS.map(
        (l) => `<button type="button" class="level-opt" data-level="${l.id}" aria-pressed="${w.level === l.id}"><strong>${l.name}</strong><span>${l.grades}</span></button>`,
      ).join("")}</div>
      <div class="row"><button class="btn btn-ghost" type="button" id="back">Back</button></div>`;
    app.querySelectorAll("[data-level]").forEach((b) =>
      b.addEventListener("click", () => {
        if (w.level !== b.dataset.level) w.subjects = [...levelOf(b.dataset.level).subjects];
        w.level = b.dataset.level;
        w.step = 3;
        draw();
      }),
    );
    app.querySelector("#back").addEventListener("click", () => {
      w.step = 1;
      draw();
    });
  };

  const drawSubjects = () => {
    const level = levelOf(w.level);
    const decks = startersFor(w.level, w.subjects);
    const offered = SUBJECTS.filter((s) => level.subjects.includes(s.id));
    app.innerHTML = `${header("What are you studying?", "Pick your subjects. We'll add a few ready-made decks for each; you can change or delete them anytime.")}
      <div class="chips onboard-subjects" role="group" aria-label="Subjects">${offered
        .map(
          (s) => `<label class="chip-check" data-subject="${s.id}"><input type="checkbox" value="${s.id}" ${w.subjects.includes(s.id) ? "checked" : ""}><span><span class="subject-dot" aria-hidden="true"></span>${s.name}</span></label>`,
        )
        .join("")}</div>
      <p class="onboard-count" aria-live="polite">${decks.length ? `${plural(decks.length, "starter deck")} to start with.` : "No starter decks. You'll make your own."}</p>
      <div class="row">
        <button class="btn btn-primary btn-lg" type="button" id="finish">Start learning</button>
        <button class="btn btn-ghost" type="button" id="back">Back</button>
      </div>
      <p class="hint">Already use PrepPop on another device? After this, go to Settings → Sync across devices → I already have a sync key.</p>`;
    app.querySelectorAll(".onboard-subjects input").forEach((box) =>
      box.addEventListener("change", () => {
        w.subjects = [...app.querySelectorAll(".onboard-subjects input:checked")].map((x) => x.value);
        const n = startersFor(w.level, w.subjects).length;
        app.querySelector(".onboard-count").textContent = n ? `${plural(n, "starter deck")} to start with.` : "No starter decks. You'll make your own.";
      }),
    );
    app.querySelector("#back").addEventListener("click", () => {
      w.step = 2;
      draw();
    });
    app.querySelector("#finish").addEventListener("click", finish);
  };

  let finishing = false;
  const finish = () => {
    if (finishing) return;
    finishing = true;
    const added = addProfile(refreshRegistry(), { name: w.name, avatar: w.avatar, level: w.level });
    if (!added) {
      finishing = false;
      return announce("This device already has the most learners it can hold.");
    }
    // The new learner's data is built on its own and saved under its own key,
    // so the learner who was using the app (and any sync still running for
    // them) is never touched.
    const fresh = migrate({});
    const level = levelOf(w.level);
    fresh.settings.dailyGoal = level.dailyGoal;
    if (w.level === "elementary") fresh.settings.test = { confidence: false };
    const now = Date.now();
    for (const s of startersFor(w.level, w.subjects)) {
      fresh.decks.push({ id: uid(), name: s.name, subject: s.subject, ordered: s.ordered, starter: s.id, createdAt: now, updatedAt: now, cards: s.cards.map((c) => ({ ...blankCard(), ...c })) });
    }
    try {
      localStorage.setItem(profileKey(added.profile.id), JSON.stringify(fresh));
    } catch {
      finishing = false;
      return announce("Couldn't save. Browser storage is full or blocked.");
    }
    session.registry = added.registry;
    saveRegistry(session.registry);
    // Reload so every screen starts with this learner's data.
    location.hash = "#/";
    location.reload();
  };

  draw();
}
