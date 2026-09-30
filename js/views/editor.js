import { state, persist, blankCard } from "../store.js";
import { esc, plural, uid } from "../util.js";
import { app, toast, setTitle, view } from "../ui.js";

export function renderEditor(deck) {
  const isNew = !deck;
  setTitle(isNew ? "New deck" : `Edit ${deck.name}`);
  const draft = deck
    ? { name: deck.name, cards: deck.cards.map((c) => ({ ...c })) }
    : { name: "", cards: [blankCard(), blankCard(), blankCard()] };
  if (!draft.cards.length) draft.cards.push(blankCard());

  let dirty = false;
  view.leaveGuard = () => !dirty || confirm("Leave without saving? Your changes will be lost.");
  const onUnload = (e) => {
    if (dirty) e.preventDefault();
  };
  window.addEventListener("beforeunload", onUnload);
  view.cleanup = () => window.removeEventListener("beforeunload", onUnload);

  app.innerHTML = `
    <form class="editor" novalidate>
      <header class="page-head">
        <div>
          <a class="back" href="#/">← Decks</a>
          <h1>${isNew ? "New deck" : "Edit deck"}</h1>
        </div>
        <div class="head-actions">
          ${isNew ? "" : `<button class="btn btn-danger" type="button" id="delete">Delete deck</button>`}
          <button class="btn btn-primary" type="submit">Save deck</button>
        </div>
      </header>
      <label class="field">
        <span class="field-label">Deck name</span>
        <input class="input input-lg" id="deck-name" value="${esc(draft.name)}" placeholder="e.g. Spanish verbs, Cell biology" maxlength="120" autocomplete="off">
      </label>
      <p class="form-error" id="form-error" role="alert" hidden></p>
      <ol class="card-list" id="card-list" aria-label="Cards"></ol>
      <button class="add-card" type="button" id="add-card">+ Add card</button>
      <div class="editor-foot">
        <span id="card-count"></span>
        <button class="btn btn-primary" type="submit">Save deck</button>
      </div>
    </form>`;

  const form = app.querySelector("form");
  const list = app.querySelector("#card-list");
  const errorEl = app.querySelector("#form-error");
  const nameInput = app.querySelector("#deck-name");

  const draw = () => {
    list.innerHTML = draft.cards.map(cardRow).join("");
    const filled = draft.cards.filter((c) => c.term.trim() || c.definition.trim()).length;
    app.querySelector("#card-count").textContent = plural(filled, "card");
  };

  const addCard = () => {
    draft.cards.push(blankCard());
    draw();
    list.lastElementChild.querySelector("textarea").focus();
  };

  nameInput.addEventListener("input", () => {
    draft.name = nameInput.value;
    dirty = true;
  });

  list.addEventListener("input", (e) => {
    const row = e.target.closest(".card-row");
    const card = draft.cards.find((c) => c.id === row.dataset.id);
    card[e.target.dataset.side] = e.target.value;
    row.classList.remove("invalid");
    dirty = true;
    const filled = draft.cards.filter((c) => c.term.trim() || c.definition.trim()).length;
    app.querySelector("#card-count").textContent = plural(filled, "card");
  });

  list.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove]");
    if (!btn) return;
    const index = draft.cards.findIndex((c) => c.id === btn.closest(".card-row").dataset.id);
    draft.cards.splice(index, 1);
    if (!draft.cards.length) draft.cards.push(blankCard());
    dirty = true;
    draw();
    const next = list.children[Math.min(index, list.children.length - 1)];
    next?.querySelector("textarea").focus();
  });

  // Tab out of the last definition to start a new card.
  list.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || e.shiftKey || e.target.dataset.side !== "definition") return;
    if (e.target.closest(".card-row") !== list.lastElementChild) return;
    e.preventDefault();
    addCard();
  });

  app.querySelector("#add-card").addEventListener("click", addCard);

  app.querySelector("#delete")?.addEventListener("click", () => {
    if (!confirm(`Delete "${deck.name}" and all of its cards? This can't be undone.`)) return;
    state.decks = state.decks.filter((d) => d.id !== deck.id);
    persist();
    dirty = false;
    toast("Deck deleted");
    location.hash = "#/";
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = draft.name.trim();
    const cards = draft.cards
      .map((c) => ({ ...c, term: c.term.trim(), definition: c.definition.trim() }))
      .filter((c) => c.term || c.definition);
    const incomplete = cards.filter((c) => !c.term || !c.definition);

    const fail = (message, focusEl) => {
      errorEl.textContent = message;
      errorEl.hidden = false;
      focusEl?.focus();
    };
    list.querySelectorAll(".card-row").forEach((row) => {
      row.classList.toggle("invalid", incomplete.some((c) => c.id === row.dataset.id));
    });
    if (!name) return fail("Give your deck a name.", nameInput);
    if (!cards.length) return fail("Add at least one card with a term and a definition.", list.querySelector("textarea"));
    if (incomplete.length) {
      const row = list.querySelector(".card-row.invalid");
      const empty = [...row.querySelectorAll("textarea")].find((t) => !t.value.trim());
      return fail("Every card needs both a term and a definition.", empty);
    }

    if (isNew) {
      state.decks.push({ id: uid(), name, createdAt: Date.now(), cards });
    } else {
      Object.assign(deck, { name, cards });
    }
    persist();
    dirty = false;
    toast(isNew ? "Deck created" : "Deck saved");
    location.hash = "#/";
  });

  draw();
  if (isNew) nameInput.focus();
}

function cardRow(card, i) {
  return `
    <li class="card-row" data-id="${card.id}">
      <span class="card-num" aria-hidden="true">${i + 1}</span>
      <label class="field">
        <span class="field-label">Term</span>
        <textarea class="input" data-side="term" rows="2" placeholder="Term" aria-label="Card ${i + 1} term">${esc(card.term)}</textarea>
      </label>
      <label class="field">
        <span class="field-label">Definition</span>
        <textarea class="input" data-side="definition" rows="2" placeholder="Definition" aria-label="Card ${i + 1} definition">${esc(card.definition)}</textarea>
      </label>
      <button class="icon-btn" type="button" data-remove aria-label="Delete card ${i + 1}">×</button>
    </li>`;
}
