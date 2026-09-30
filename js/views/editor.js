import { state, persist, blankCard, deleteDeck, touch, forgetCards } from "../store.js";
import { esc, plural, uid } from "../util.js";
import { app, toast, setTitle, view, saveFile } from "../ui.js";
import { makeDeckFile } from "../backup.js";
import { makeCardsFromNotes, MAX_NOTES, MODEL_LABEL } from "../ai.js";
import { parseList, SEPARATORS } from "../import.js";
import { SUBJECTS, guessSubject } from "../subjects.js";

export function renderEditor(deck) {
  const isNew = !deck;
  setTitle(isNew ? "New deck" : `Edit ${deck.name}`);
  const draft = deck
    ? { name: deck.name, subject: deck.subject, ordered: Boolean(deck.ordered), cards: deck.cards.map((c) => ({ ...c })) }
    : { name: "", subject: state.settings.lastSubject ?? "other", ordered: false, cards: [blankCard(), blankCard(), blankCard()] };
  let subjectPicked = !isNew;
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
          ${isNew ? "" : `<button class="btn btn-soft" type="button" id="share">Share deck</button>`}
          <button class="btn btn-primary" type="submit">Save deck</button>
        </div>
      </header>
      <label class="field">
        <span class="field-label">Deck name</span>
        <input class="input input-lg" id="deck-name" value="${esc(draft.name)}" placeholder="e.g. Spanish verbs, Cell biology" maxlength="120" autocomplete="off">
      </label>
      <fieldset class="subject-picker">
        <legend class="field-label">Subject</legend>
        <div class="chips">
          ${SUBJECTS.map((s) => `
            <label class="chip-radio" data-subject="${s.id}">
              <input type="radio" name="subject" value="${s.id}" ${draft.subject === s.id ? "checked" : ""}>
              <span><span class="subject-dot" aria-hidden="true"></span>${s.name}</span>
            </label>`).join("")}
        </div>
      </fieldset>
      <label class="check order-check"><input type="checkbox" id="ordered" ${draft.ordered ? "checked" : ""}> <span>Cards are in order, like the steps of a procedure or a timeline. Adds <strong>Steps</strong> practice.</span></label>
      <p class="form-error" id="form-error" role="alert" hidden></p>
      <div class="import-bar">
        <button class="btn btn-soft" type="button" id="toggle-import" aria-expanded="false" aria-controls="import-panel">Paste a list</button>
        <button class="btn btn-soft" type="button" id="toggle-notes" aria-expanded="false" aria-controls="notes-panel"><span class="spark" aria-hidden="true">✦</span> Cards from notes</button>
        <span class="hint">Paste a vocab list, or paste your class notes and let AI suggest cards.</span>
      </div>
      <section class="panel import-panel" id="notes-panel" hidden aria-labelledby="notes-heading">
        <h2 id="notes-heading">Make cards from your notes</h2>
        <p>Paste notes from class or a study guide. ${MODEL_LABEL} suggests flashcards; you pick which to keep and can edit them before saving.</p>
        <label class="field">
          <span class="field-label">Your notes</span>
          <textarea class="input" id="notes-text" rows="8" maxlength="${MAX_NOTES}" placeholder="The heart has four chambers: two atria on top and two ventricles below. The right side pumps blood to the lungs…"></textarea>
        </label>
        <p class="hint" id="notes-count">0 / ${MAX_NOTES.toLocaleString()} characters</p>
        <div class="row">
          <button class="btn btn-primary" type="button" id="notes-make">Suggest cards</button>
          <button class="btn btn-ghost" type="button" id="notes-cancel">Cancel</button>
        </div>
        <div id="notes-result" aria-live="polite"></div>
      </section>
      <section class="panel import-panel" id="import-panel" hidden aria-labelledby="import-heading">
        <h2 id="import-heading">Paste a list</h2>
        <label class="field">
          <span class="field-label">One card per line</span>
          <textarea class="input" id="import-text" rows="7" spellcheck="false" placeholder="mitochondria - makes energy for the cell&#10;ribosome - builds proteins&#10;nucleus - holds the cell's DNA"></textarea>
        </label>
        <div class="row import-options">
          <label class="inline-field">Between term and definition
            <select class="input select" id="import-sep">
              <option value="auto">Detect automatically</option>
              ${Object.entries(SEPARATORS).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join("")}
            </select>
          </label>
          <label class="check"><input type="checkbox" id="import-swap"> Definition comes first</label>
        </div>
        <p class="hint" id="import-summary" aria-live="polite">Works with lists like "term - definition", "term: definition", or a Quizlet export.</p>
        <ul class="import-preview" id="import-preview"></ul>
        <div class="row">
          <button class="btn btn-primary" type="button" id="import-add" disabled>Add cards</button>
          <button class="btn btn-ghost" type="button" id="import-cancel">Cancel</button>
        </div>
      </section>
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

  const pickSubject = (id) => {
    draft.subject = id;
    const radio = app.querySelector(`input[name="subject"][value="${id}"]`);
    if (radio) radio.checked = true;
  };
  nameInput.addEventListener("input", () => {
    draft.name = nameInput.value;
    dirty = true;
    const guess = !subjectPicked && guessSubject(draft.name);
    if (guess) pickSubject(guess);
  });
  app.querySelector("#ordered").addEventListener("change", (e) => {
    draft.ordered = e.target.checked;
    dirty = true;
  });
  app.querySelectorAll('input[name="subject"]').forEach((radio) =>
    radio.addEventListener("change", () => {
      subjectPicked = true;
      dirty = true;
      draft.subject = radio.value;
    }),
  );

  // Paste-a-list import
  const importPanel = app.querySelector("#import-panel");
  const importToggle = app.querySelector("#toggle-import");
  const importText = app.querySelector("#import-text");
  const importSep = app.querySelector("#import-sep");
  const importSwap = app.querySelector("#import-swap");
  const importAdd = app.querySelector("#import-add");
  let parsed = { cards: [], skipped: [] };

  const showImport = (open) => {
    importPanel.hidden = !open;
    importToggle.setAttribute("aria-expanded", open);
    if (open) importText.focus();
    else importToggle.focus();
  };
  const refreshImport = () => {
    parsed = parseList(importText.value, { sep: importSep.value, swap: importSwap.checked });
    const n = parsed.cards.length;
    const summary = app.querySelector("#import-summary");
    if (!importText.value.trim()) {
      summary.textContent = `Works with lists like "term - definition", "term: definition", or a Quizlet export.`;
    } else if (!n) {
      summary.textContent = "Couldn't find a term and definition on each line. Try picking the separator yourself.";
    } else {
      const skipped = parsed.skipped.length ? ` ${plural(parsed.skipped.length, "line")} skipped (no separator).` : "";
      summary.textContent = `${plural(n, "card")} found.${skipped}`;
    }
    app.querySelector("#import-preview").innerHTML = parsed.cards
      .slice(0, 4)
      .map((c) => `<li><strong>${esc(c.term)}</strong><span>${esc(c.definition)}</span></li>`)
      .join("") + (n > 4 ? `<li class="more">+ ${n - 4} more</li>` : "");
    importAdd.disabled = !n;
    importAdd.textContent = n ? `Add ${plural(n, "card")}` : "Add cards";
  };

  importToggle.addEventListener("click", () => {
    showNotes(false, false);
    showImport(importPanel.hidden);
  });

  // Cards from notes (AI)
  const notesPanel = app.querySelector("#notes-panel");
  const notesToggle = app.querySelector("#toggle-notes");
  const notesText = app.querySelector("#notes-text");
  const notesResult = app.querySelector("#notes-result");
  let suggestions = [];
  const showNotes = (open, moveFocus = true) => {
    notesPanel.hidden = !open;
    notesToggle.setAttribute("aria-expanded", open);
    if (!moveFocus) return;
    if (open) notesText.focus();
    else notesToggle.focus();
  };
  notesToggle.addEventListener("click", () => {
    if (!importPanel.hidden) showImport(false);
    showNotes(notesPanel.hidden);
  });
  app.querySelector("#notes-cancel").addEventListener("click", () => showNotes(false));
  notesText.addEventListener("input", () => {
    app.querySelector("#notes-count").textContent = `${notesText.value.length.toLocaleString()} / ${MAX_NOTES.toLocaleString()} characters`;
  });
  const drawSuggestions = () => {
    const picked = suggestions.filter((s) => s.keep).length;
    notesResult.innerHTML = suggestions.length
      ? `<p class="notes-found">${plural(suggestions.length, "card")} suggested. Untick any you don't want.</p>
         <ul class="suggestions">${suggestions
           .map(
             (s, i) => `<li><label class="suggestion"><input type="checkbox" data-keep="${i}" ${s.keep ? "checked" : ""}>
               <span><strong>${esc(s.term)}</strong><span>${esc(s.definition)}</span></span></label></li>`,
           )
           .join("")}</ul>
         <div class="row"><button class="btn btn-primary" type="button" id="notes-add" ${picked ? "" : "disabled"}>Add ${plural(picked, "card")}</button></div>`
      : `<p class="hint">No cards came out of those notes. Try pasting more detail.</p>`;
    notesResult.querySelectorAll("[data-keep]").forEach((box) =>
      box.addEventListener("change", () => {
        suggestions[Number(box.dataset.keep)].keep = box.checked;
        const n = suggestions.filter((s) => s.keep).length;
        const add = notesResult.querySelector("#notes-add");
        add.disabled = !n;
        add.textContent = `Add ${plural(n, "card")}`;
      }),
    );
    notesResult.querySelector("#notes-add")?.addEventListener("click", () => {
      const keep = suggestions.filter((s) => s.keep);
      draft.cards = draft.cards.filter((c) => c.term.trim() || c.definition.trim());
      draft.cards.push(...keep.map(({ term, definition }) => ({ ...blankCard(), term, definition })));
      dirty = true;
      draw();
      suggestions = [];
      notesResult.innerHTML = "";
      notesText.value = "";
      showNotes(false);
      toast(`Added ${plural(keep.length, "card")}. Check them over, then save.`);
    });
  };
  app.querySelector("#notes-make").addEventListener("click", async (e) => {
    const notes = notesText.value.trim();
    if (notes.length < 20) {
      notesResult.innerHTML = `<p class="form-error">Paste a bit more of your notes first.</p>`;
      return;
    }
    const button = e.currentTarget;
    button.disabled = true;
    button.textContent = "Reading your notes…";
    notesResult.innerHTML = `<div class="loader small" aria-hidden="true"><span></span><span></span><span></span></div><p class="hint">This can take up to half a minute.</p>`;
    try {
      const cards = await makeCardsFromNotes({ notes, subject: draft.subject, deckName: draft.name });
      if (!notesResult.isConnected) return;
      suggestions = cards.map((c) => ({ ...c, keep: true }));
      drawSuggestions();
    } catch (err) {
      if (!notesResult.isConnected) return;
      notesResult.innerHTML = `<p class="form-error">Couldn't make cards: ${esc(err.message)}.</p>`;
    } finally {
      button.disabled = false;
      button.textContent = "Suggest cards";
    }
  });
  app.querySelector("#import-cancel").addEventListener("click", () => showImport(false));
  [importText, importSep, importSwap].forEach((el) => el.addEventListener("input", refreshImport));
  importAdd.addEventListener("click", () => {
    const n = parsed.cards.length;
    if (!n) return;
    draft.cards = draft.cards.filter((c) => c.term.trim() || c.definition.trim());
    draft.cards.push(...parsed.cards.map((c) => ({ ...blankCard(), ...c })));
    dirty = true;
    draw();
    importText.value = "";
    refreshImport();
    showImport(false);
    toast(`Added ${plural(n, "card")}. Remember to save.`);
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
    const move = e.target.closest("[data-move]");
    if (move) {
      const from = draft.cards.findIndex((c) => c.id === move.closest(".card-row").dataset.id);
      const to = from + Number(move.dataset.move);
      if (to < 0 || to >= draft.cards.length) return;
      [draft.cards[from], draft.cards[to]] = [draft.cards[to], draft.cards[from]];
      dirty = true;
      draw();
      list.children[to]?.querySelector(`[data-move="${move.dataset.move}"]`)?.focus();
      return;
    }
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

  app.querySelector("#share")?.addEventListener("click", async () => {
    const slug = deck.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "deck";
    const shared = await saveFile(`${slug}.preppop.json`, JSON.stringify(makeDeckFile(deck), null, 1));
    if (shared) toast(dirty ? "Shared the last saved version of this deck" : "Deck file ready to share");
  });

  app.querySelector("#delete")?.addEventListener("click", () => {
    if (!confirm(`Delete "${deck.name}" and all of its cards? This can't be undone.`)) return;
    deleteDeck(deck);
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
      state.decks.push({ id: uid(), name, subject: draft.subject, ordered: draft.ordered, createdAt: Date.now(), updatedAt: Date.now(), cards });
    } else {
      const kept = new Set(cards.map((c) => c.id));
      forgetCards(deck, deck.cards.filter((c) => !kept.has(c.id)).map((c) => c.id));
      Object.assign(deck, { name, subject: draft.subject, ordered: draft.ordered, cards });
      touch(deck);
    }
    state.settings.lastSubject = draft.subject;
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
      <div class="row-tools">
        <button class="icon-btn move" type="button" data-move="-1" aria-label="Move card ${i + 1} up">↑</button>
        <button class="icon-btn move" type="button" data-move="1" aria-label="Move card ${i + 1} down">↓</button>
        <button class="icon-btn" type="button" data-remove aria-label="Delete card ${i + 1}">×</button>
      </div>
    </li>`;
}
