// Who's learning? Switch between the learners on this device, add one, or
// change or remove one. Each learner's decks and progress are separate.

import { state, setStoreKey } from "../store.js";
import { esc } from "../util.js";
import { app, setTitle, toast, announce } from "../ui.js";
import { LEVELS, levelOf } from "../starters.js";
import { session, AVATARS, MAX_NAME, MAX_PROFILES, saveRegistry, updateProfile, removeProfile, switchTo, displayName } from "../profiles.js";

export function renderProfiles({ editing = null } = {}) {
  setTitle("Who's learning?");
  const reg = session.registry;
  if (!reg) return;

  app.innerHTML = `
    <header class="page-head">
      <div>
        <a class="back" href="#/">← Decks</a>
        <h1>Who's learning?</h1>
        <p class="lede">Each learner has their own decks, progress, and settings on this device. No email or password.</p>
      </div>
    </header>
    <ul class="profile-list">${reg.list
      .map((p) => {
        const active = p.id === reg.active;
        if (p.id === editing) return `<li class="profile-card editing">${editForm(p)}</li>`;
        return `
        <li class="profile-card ${active ? "is-active" : ""}">
          <button type="button" class="profile-main" data-switch="${p.id}" ${active ? 'aria-current="true"' : ""}>
            <span class="profile-avatar" aria-hidden="true">${p.avatar}</span>
            <span class="profile-text"><strong>${esc(displayName(p))}</strong><span>${levelOf(p.level).name}${active ? " · learning now" : ""}</span></span>
          </button>
          <div class="profile-tools">
            <button class="text-btn" type="button" data-edit="${p.id}">Edit<span class="visually-hidden"> ${esc(displayName(p))}</span></button>
            ${reg.list.length > 1 ? `<button class="text-btn danger" type="button" data-remove="${p.id}">Remove<span class="visually-hidden"> ${esc(displayName(p))}</span></button>` : ""}
          </div>
        </li>`;
      })
      .join("")}</ul>
    ${reg.list.length < MAX_PROFILES ? `<div class="row"><a class="btn btn-primary" href="#/welcome/add">+ Add a learner</a></div>` : `<p class="hint">This device has the most learners it can hold (${MAX_PROFILES}).</p>`}`;

  app.querySelectorAll("[data-switch]").forEach((b) =>
    b.addEventListener("click", () => {
      if (b.dataset.switch === reg.active) location.hash = "#/";
      else switchTo(b.dataset.switch);
    }),
  );
  app.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => renderProfiles({ editing: b.dataset.edit })));
  app.querySelectorAll("[data-remove]").forEach((b) => b.addEventListener("click", () => remove(b.dataset.remove)));

  const form = app.querySelector(".profile-edit");
  if (form) {
    form.querySelector("#edit-name").focus();
    form.querySelector("#edit-cancel").addEventListener("click", () => renderProfiles());
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = form.querySelector("#edit-name").value;
      if (!name.trim()) return form.querySelector("#edit-name").focus();
      const p = updateProfile(reg, editing, {
        name,
        avatar: form.querySelector('input[name="edit-avatar"]:checked')?.value,
        level: form.querySelector("#edit-level").value,
      });
      saveRegistry(reg);
      // The header shows the active learner, so a change there needs a fresh page.
      if (p.id === reg.active) {
        document.documentElement.dataset.level = p.level;
        window.dispatchEvent(new Event("profilechange"));
      }
      renderProfiles();
      toast("Saved");
    });
  }
}

const editForm = (p) => `
  <form class="profile-edit" novalidate>
    <label class="field">
      <span class="field-label">Name or nickname</span>
      <input class="input" id="edit-name" maxlength="${MAX_NAME}" autocomplete="off" value="${esc(p.name)}">
    </label>
    <fieldset class="avatar-pick">
      <legend class="field-label">Avatar</legend>
      <div class="avatars">${AVATARS.map(
        (a, i) => `<label class="avatar-opt"><input type="radio" name="edit-avatar" value="${a}" ${a === p.avatar ? "checked" : ""}><span aria-hidden="true">${a}</span><span class="visually-hidden">Avatar ${i + 1}</span></label>`,
      ).join("")}</div>
    </fieldset>
    <label class="field">
      <span class="field-label">School level</span>
      <select class="input" id="edit-level">${LEVELS.map((l) => `<option value="${l.id}" ${l.id === p.level ? "selected" : ""}>${l.name} (${l.grades.toLowerCase()})</option>`).join("")}</select>
    </label>
    <p class="hint">Changing the level changes which starter decks are suggested. Existing decks stay.</p>
    <div class="row"><button class="btn btn-primary" type="submit">Save</button><button class="btn btn-ghost" type="button" id="edit-cancel">Cancel</button></div>
  </form>`;

function remove(id) {
  const reg = session.registry;
  const p = reg.list.find((x) => x.id === id);
  const syncing = id === reg.active && state.sync;
  const ok = confirm(
    `Remove ${displayName(p)} from this device? Their decks and progress on this device will be deleted.${syncing ? " Their synced copy stays in the cloud until it's unused for 12 months; turn off sync in Settings first to erase it." : " If they use sync, their other devices keep their copy."}`,
  );
  if (!ok) return;
  const wasActive = id === reg.active;
  // Anything saved before the reload goes nowhere instead of recreating the removed learner.
  if (wasActive) setStoreKey("preppop:discard");
  removeProfile(reg, id);
  saveRegistry(reg);
  if (wasActive) return switchTo(reg.active);
  renderProfiles();
  announce(`${displayName(p)} removed.`);
}
