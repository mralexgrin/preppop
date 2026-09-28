import { writeWrongAnswers, normalize, MODEL_LABEL } from "./ai.js";

const STORE_KEY = "preppop:v1";
const app = document.getElementById("app");
const toastEl = document.getElementById("toast");

// ---------- State ----------

let state = loadState();

function loadState() {
  const fresh = { decks: [], distractors: {} };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return fresh;
    // Keys were stored here before the answer service existed; drop them.
    const { apiKey, ...saved } = JSON.parse(raw);
    if (apiKey !== undefined) localStorage.setItem(STORE_KEY, JSON.stringify(saved));
    return { ...fresh, ...saved };
  } catch {
    return fresh;
  }
}

function persist() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    toast("Couldn't save. Browser storage is full or blocked.");
  }
}

const getDeck = (id) => state.decks.find((d) => d.id === id);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const blankCard = () => ({ id: uid(), term: "", definition: "", status: "new" });

// ---------- Helpers ----------

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

let toastTimer;
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
}

function statusChip(status) {
  if (status === "known") return `<span class="chip know">Known</span>`;
  if (status === "learning") return `<span class="chip learn">Still learning</span>`;
  return `<span class="chip new">New</span>`;
}

const isTyping = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

// ---------- Router ----------

let cleanup = null;
let leaveGuard = null;
let currentHash = location.hash || "#/";

window.addEventListener("hashchange", () => {
  if (leaveGuard && !leaveGuard()) {
    history.replaceState(null, "", currentHash);
    return;
  }
  route();
});

function route() {
  cleanup?.();
  cleanup = null;
  leaveGuard = null;
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

function setTitle(title) {
  document.title = title ? `${title} · PrepPop` : "PrepPop";
}

// ---------- Library ----------

function renderLibrary() {
  setTitle();
  if (!state.decks.length) {
    app.innerHTML = `
      <section class="empty">
        <div class="empty-art" aria-hidden="true"><span></span><span></span><span>Aa</span></div>
        <h1>Make your first deck</h1>
        <p>Write a term on the front and a definition on the back. Then flip through the cards to study, or take a multiple-choice test.</p>
        <div class="actions">
          <a class="btn btn-primary btn-lg" href="#/new">Create a deck</a>
          <button class="btn btn-soft btn-lg" type="button" id="sample">Try a sample deck</button>
        </div>
      </section>`;
    app.querySelector("#sample").addEventListener("click", addSampleDeck);
    return;
  }

  const cardTotal = state.decks.reduce((n, d) => n + d.cards.length, 0);
  app.innerHTML = `
    <header class="page-head">
      <div>
        <h1>Your decks</h1>
        <p class="lede">${plural(state.decks.length, "deck")} · ${plural(cardTotal, "card")}</p>
      </div>
      <a class="btn btn-primary" href="#/new">+ New deck</a>
    </header>
    <ul class="deck-grid">${state.decks.map(deckTile).join("")}</ul>`;

  app.querySelector(".deck-grid").addEventListener("click", (e) => {
    const deck = getDeck(e.target.closest("[data-delete-deck]")?.dataset.deleteDeck);
    if (!deck || !confirm(`Delete "${deck.name}" and all of its cards? This can't be undone.`)) return;
    state.decks = state.decks.filter((d) => d !== deck);
    persist();
    renderLibrary();
    toast("Deck deleted");
  });
}

function deckTile(deck) {
  const total = deck.cards.length;
  const known = deck.cards.filter((c) => c.status === "known").length;
  const learning = deck.cards.filter((c) => c.status === "learning").length;
  const pct = (n) => (total ? (n / total) * 100 : 0);
  return `
    <li class="deck-tile">
      <div>
        <h2>${esc(deck.name)}</h2>
        <p class="meta">${plural(total, "card")}</p>
      </div>
      <div class="meter" role="img" aria-label="${known} of ${total} known, ${learning} still learning">
        <span class="m-know" style="width:${pct(known)}%"></span>
        <span class="m-learn" style="width:${pct(learning)}%"></span>
      </div>
      <p class="legend">
        <span><span class="dot know"></span>${known} known</span>
        <span><span class="dot learn"></span>${learning} still learning</span>
      </p>
      <div class="deck-actions">
        <a class="btn btn-soft" href="#/deck/${deck.id}/study">Flashcards</a>
        <a class="btn btn-soft" href="#/deck/${deck.id}/test">Test</a>
        <a class="btn btn-ghost" href="#/deck/${deck.id}/edit" aria-label="Edit ${esc(deck.name)}">Edit</a>
        <button class="btn btn-danger" type="button" data-delete-deck="${deck.id}" aria-label="Delete ${esc(deck.name)}">Delete</button>
      </div>
    </li>`;
}

function addSampleDeck() {
  const cards = [
    ["Mercury", "Smallest planet and the closest to the Sun"],
    ["Venus", "Hottest planet, wrapped in thick carbon dioxide clouds"],
    ["Mars", "The red planet, home to Olympus Mons"],
    ["Jupiter", "Largest planet, known for its Great Red Spot storm"],
    ["Saturn", "Gas giant with the most prominent ring system"],
    ["Neptune", "Farthest planet from the Sun, with the fastest winds"],
    ["Asteroid belt", "Ring of rocky bodies orbiting between Mars and Jupiter"],
    ["Light-year", "Distance light travels in one year, about 9.46 trillion km"],
  ].map(([term, definition]) => ({ ...blankCard(), term, definition }));
  state.decks.push({ id: uid(), name: "Solar System basics", createdAt: Date.now(), cards });
  persist();
  renderLibrary();
  toast("Sample deck added");
}

// ---------- Deck editor ----------

function renderEditor(deck) {
  const isNew = !deck;
  setTitle(isNew ? "New deck" : `Edit ${deck.name}`);
  const draft = deck
    ? { name: deck.name, cards: deck.cards.map((c) => ({ ...c })) }
    : { name: "", cards: [blankCard(), blankCard(), blankCard()] };
  if (!draft.cards.length) draft.cards.push(blankCard());

  let dirty = false;
  leaveGuard = () => !dirty || confirm("Leave without saving? Your changes will be lost.");
  const onUnload = (e) => {
    if (dirty) e.preventDefault();
  };
  window.addEventListener("beforeunload", onUnload);
  cleanup = () => window.removeEventListener("beforeunload", onUnload);

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

// ---------- Flashcards ----------

function renderStudy(deck) {
  setTitle(deck.name);
  const s = { front: "term", onlyLearning: false, order: [], i: 0, flipped: false, tally: { known: 0, learning: 0 } };
  const notKnown = () => deck.cards.filter((c) => c.status !== "known");

  const start = ({ shuffled = false } = {}) => {
    const pool = s.onlyLearning ? notKnown() : deck.cards;
    s.order = (shuffled ? shuffle(pool) : pool).map((c) => c.id);
    s.i = 0;
    s.flipped = false;
    s.tally = { known: 0, learning: 0 };
    draw();
  };

  const header = `
    <header class="page-head">
      <div>
        <a class="back" href="#/">← Decks</a>
        <h1>${esc(deck.name)}</h1>
      </div>
      <a class="btn btn-soft" href="#/deck/${deck.id}/test">Switch to Test</a>
    </header>`;

  const draw = () => {
    if (!deck.cards.length) {
      app.innerHTML = `${header}
        <div class="result"><p class="sub">This deck has no cards yet.</p>
        <div class="actions"><a class="btn btn-primary" href="#/deck/${deck.id}/edit">Add cards</a></div></div>`;
      return;
    }

    const remaining = notKnown().length;
    const toolbar = `
      <div class="toolbar">
        <div class="seg" role="group" aria-label="Show first">
          <button type="button" data-front="term" aria-pressed="${s.front === "term"}">Term first</button>
          <button type="button" data-front="definition" aria-pressed="${s.front === "definition"}">Definition first</button>
        </div>
        <div class="seg" role="group" aria-label="Which cards">
          <button type="button" data-only="all" aria-pressed="${!s.onlyLearning}">All (${deck.cards.length})</button>
          <button type="button" data-only="learning" aria-pressed="${s.onlyLearning}" ${remaining ? "" : "disabled"}>Not known yet (${remaining})</button>
        </div>
        <button class="btn btn-ghost" type="button" id="shuffle">Shuffle</button>
      </div>`;

    if (s.i >= s.order.length) {
      app.innerHTML = `${header}${toolbar}
        <section class="result">
          <p class="big">Round done</p>
          <p class="sub">You went through ${plural(s.order.length, "card")}.</p>
          <div class="tallies">
            <div class="tally know"><strong>${s.tally.known}</strong>Know it</div>
            <div class="tally learn"><strong>${s.tally.learning}</strong>Still learning</div>
          </div>
          <div class="actions">
            ${remaining ? `<button class="btn btn-primary" type="button" id="review">Review ${plural(remaining, "card")} not known yet</button>` : ""}
            <button class="btn ${remaining ? "btn-soft" : "btn-primary"}" type="button" id="restart">Study all again</button>
            <a class="btn btn-soft" href="#/deck/${deck.id}/test">Take a test</a>
          </div>
        </section>`;
      bindToolbar();
      app.querySelector("#review")?.addEventListener("click", () => {
        s.onlyLearning = true;
        start();
      });
      app.querySelector("#restart").addEventListener("click", () => {
        s.onlyLearning = false;
        start();
      });
      return;
    }

    const card = deck.cards.find((c) => c.id === s.order[s.i]);
    const back = s.front === "term" ? "definition" : "term";
    const label = { term: "Term", definition: "Definition" };
    app.innerHTML = `${header}${toolbar}
      <div class="progress">
        <div class="progress-track"><span style="width:${(s.i / s.order.length) * 100}%"></span></div>
        <span class="progress-label">${s.i + 1} / ${s.order.length}</span>
      </div>
      <button type="button" class="flip-card ${s.flipped ? "flipped" : ""}" id="flip" aria-describedby="flip-live">
        <span class="flip-inner">
          <span class="face front" aria-hidden="${s.flipped}">
            <span class="face-label">${label[s.front]}</span>
            <span class="face-status">${statusChip(card.status)}</span>
            <span class="face-text">${esc(card[s.front])}</span>
            <span class="face-hint">Tap to flip</span>
          </span>
          <span class="face back" aria-hidden="${!s.flipped}">
            <span class="face-label">${label[back]}</span>
            <span class="face-text">${esc(card[back])}</span>
            <span class="face-hint">Tap to flip back</span>
          </span>
        </span>
      </button>
      <p class="visually-hidden" id="flip-live" aria-live="polite">${s.flipped ? "Showing back" : "Showing front"}</p>
      <div class="mark-row">
        <button class="btn btn-learn" type="button" data-mark="learning"><kbd>←</kbd> Still learning</button>
        <button class="btn btn-know" type="button" data-mark="known">I know it <kbd>→</kbd></button>
      </div>
      <p class="kbd-hint">Space to flip · ← still learning · → I know it</p>
      <p class="card-tools"><button class="text-btn danger" type="button" id="delete-card">Delete this card</button></p>`;

    bindToolbar();
    const flipBtn = app.querySelector("#flip");
    flipBtn.addEventListener("click", flip);
    app.querySelectorAll("[data-mark]").forEach((b) => b.addEventListener("click", () => mark(b.dataset.mark)));
    app.querySelector("#delete-card").addEventListener("click", () => deleteCard(card));
  };

  const deleteCard = (card) => {
    if (!confirm(`Delete this card?\n\n${card.term}\n\nThis can't be undone.`)) return;
    deck.cards = deck.cards.filter((c) => c !== card);
    s.order = s.order.filter((id) => id !== card.id);
    s.flipped = false;
    persist();
    draw();
    toast("Card deleted");
  };

  const bindToolbar = () => {
    app.querySelectorAll("[data-front]").forEach((b) =>
      b.addEventListener("click", () => {
        s.front = b.dataset.front;
        s.flipped = false;
        draw();
      }),
    );
    app.querySelectorAll("[data-only]").forEach((b) =>
      b.addEventListener("click", () => {
        s.onlyLearning = b.dataset.only === "learning";
        start();
      }),
    );
    app.querySelector("#shuffle").addEventListener("click", () => {
      start({ shuffled: true });
      toast("Cards shuffled");
    });
  };

  const flip = () => {
    const flipBtn = app.querySelector("#flip");
    if (!flipBtn) return;
    s.flipped = !s.flipped;
    flipBtn.classList.toggle("flipped", s.flipped);
    flipBtn.querySelector(".front").setAttribute("aria-hidden", s.flipped);
    flipBtn.querySelector(".back").setAttribute("aria-hidden", !s.flipped);
    app.querySelector("#flip-live").textContent = s.flipped ? "Showing back" : "Showing front";
  };

  const mark = (status) => {
    if (s.i >= s.order.length) return;
    const card = deck.cards.find((c) => c.id === s.order[s.i]);
    card.status = status;
    persist();
    s.tally[status]++;
    s.i++;
    s.flipped = false;
    draw();
    app.querySelector("#flip")?.focus({ preventScroll: true });
  };

  const onKey = (e) => {
    if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "ArrowRight") mark("known");
    else if (e.key === "ArrowLeft") mark("learning");
    else if ((e.key === " " || e.key === "Enter") && (e.target === document.body || e.target === app)) {
      e.preventDefault();
      flip();
    }
  };
  document.addEventListener("keydown", onKey);
  cleanup = () => document.removeEventListener("keydown", onKey);

  start();
}

// ---------- Test ----------

const MODES = {
  term: { title: "Show term", desc: "Pick the matching definition" },
  definition: { title: "Show definition", desc: "Pick the matching term" },
  mix: { title: "Mix it up", desc: "A bit of both, at random" },
};

function renderTest(deck) {
  setTitle(`${deck.name} test`);
  const t = { phase: "setup", mode: "term", questions: [], i: 0, score: 0, notice: "" };
  let alive = true;

  const header = (right = "") => `
    <header class="page-head">
      <div>
        <a class="back" href="#/">← Decks</a>
        <h1>${esc(deck.name)}</h1>
      </div>
      ${right}
    </header>`;

  const draw = () => {
    if (t.phase === "setup") return drawSetup();
    if (t.phase === "loading") {
      app.innerHTML = `${header()}
        <section class="loading" aria-live="polite">
          <div class="loader" aria-hidden="true"><span></span><span></span><span></span></div>
          <h2>Writing tricky wrong answers…</h2>
          <p>${MODEL_LABEL} is making believable choices for ${plural(t.questions.length, "question")}.</p>
        </section>`;
      return;
    }
    if (t.phase === "question") return drawQuestion();
    drawDone();
  };

  const drawSetup = () => {
    const n = deck.cards.length;
    app.innerHTML = `${header(`<a class="btn btn-soft" href="#/deck/${deck.id}/study">Switch to Flashcards</a>`)}
      ${t.notice ? `<div class="notice warn" role="alert">${esc(t.notice)}</div>` : ""}
      <div class="notice ai"><span class="spark" aria-hidden="true">✦</span><span>${MODEL_LABEL} writes 3 believable wrong answers for every question.</span></div>
      <fieldset class="choice-fieldset" style="border:0;padding:0;margin:0">
        <legend class="setup-label">How should questions look?</legend>
        <div class="choice-grid">
          ${Object.entries(MODES)
            .map(
              ([key, m]) => `
            <label class="choice">
              <input type="radio" name="mode" value="${key}" ${t.mode === key ? "checked" : ""}>
              <span><strong>${m.title}</strong><small>${m.desc}</small></span>
            </label>`,
            )
            .join("")}
        </div>
      </fieldset>
      <div class="row">
        <button class="btn btn-primary btn-lg" type="button" id="start" ${n ? "" : "disabled"}>Start test · ${plural(n, "question")}</button>
        ${n ? "" : `<span class="hint">Add some cards to this deck first.</span>`}
      </div>`;
    app.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener("change", () => (t.mode = r.value)));
    app.querySelector("#start").addEventListener("click", start);
  };

  const cacheKey = (q) => `${q.shows}:${hash(q.prompt)}:${hash(q.answer)}`;

  const start = async () => {
    t.notice = "";
    t.i = 0;
    t.score = 0;
    t.questions = shuffle(deck.cards).map((card) => {
      const shows = t.mode === "mix" ? (Math.random() < 0.5 ? "term" : "definition") : t.mode;
      const hidden = shows === "term" ? "definition" : "term";
      return { card, shows, prompt: card[shows], answer: card[hidden], options: [], chosen: null, ai: false };
    });

    const missing = t.questions.filter((q) => !state.distractors[cacheKey(q)]);
    if (missing.length) {
      t.phase = "loading";
      draw();
      try {
        const written = await writeWrongAnswers({
          deckName: deck.name,
          items: missing.map((q) => ({ key: cacheKey(q), shows: q.shows, prompt: q.prompt, answer: q.answer })),
        });
        Object.assign(state.distractors, written);
        persist();
      } catch (err) {
        t.notice = `Couldn't get AI answers: ${err.message}. Using your other cards instead.`;
      }
      if (!alive) return;
    }

    for (const q of t.questions) {
      const fromAi = state.distractors[cacheKey(q)] ?? [];
      const seen = new Set([normalize(q.answer), ...fromAi.map(normalize)]);
      const fromDeck = shuffle(deck.cards)
        .map((c) => c[q.shows === "term" ? "definition" : "term"])
        .filter((a) => !seen.has(normalize(a)) && seen.add(normalize(a)));
      const wrong = [...fromAi, ...fromDeck].slice(0, 3);
      q.ai = fromAi.length > 0;
      q.options = shuffle([q.answer, ...wrong]);
    }

    if (t.questions.some((q) => q.options.length < 2)) {
      t.phase = "setup";
      t.notice ||= "Not enough cards to build answer choices.";
      t.notice += " Add more cards to take a test.";
      return draw();
    }
    t.phase = "question";
    draw();
  };

  const drawQuestion = () => {
    const q = t.questions[t.i];
    const answered = q.chosen !== null;
    const correctIndex = q.options.indexOf(q.answer);
    const last = t.i === t.questions.length - 1;
    const optionClass = (i) => {
      if (!answered) return "";
      if (i === correctIndex) return "is-correct";
      if (i === q.chosen) return "is-wrong";
      return "dim";
    };

    app.innerHTML = `${header(`<span class="progress-label">Score ${t.score}</span>`)}
      ${t.notice ? `<div class="notice warn" role="alert">${esc(t.notice)}</div>` : ""}
      <div class="progress">
        <div class="progress-track"><span style="width:${((t.i + (answered ? 1 : 0)) / t.questions.length) * 100}%"></span></div>
        <span class="progress-label">${t.i + 1} / ${t.questions.length}</span>
      </div>
      <section class="q-card ${q.shows === "definition" ? "def" : ""}" aria-labelledby="q-prompt">
        <span class="face-label">${q.shows === "term" ? "Term" : "Definition"}</span>
        <p class="q-prompt" id="q-prompt">${esc(q.prompt)}</p>
      </section>
      <p class="q-instruction" id="q-instruction">Pick the matching ${q.shows === "term" ? "definition" : "term"}</p>
      <div class="options" role="group" aria-labelledby="q-instruction">
        ${q.options
          .map(
            (opt, i) => `
          <button type="button" class="option ${optionClass(i)}" data-i="${i}" ${answered ? "disabled" : ""}>
            <span class="opt-key" aria-hidden="true">${i + 1}</span>
            <span class="opt-text">${esc(opt)}</span>
          </button>`,
          )
          .join("")}
      </div>
      <div class="q-foot">
        <p class="feedback ${answered ? (q.chosen === correctIndex ? "good" : "bad") : ""}" aria-live="polite">
          ${answered ? (q.chosen === correctIndex ? "Correct!" : "Not quite. The right answer is highlighted in green.") : ""}
        </p>
        ${answered ? `<button class="btn btn-primary" type="button" id="next">${last ? "See results" : "Next question"} <kbd>Enter</kbd></button>` : ""}
      </div>
      <p class="source-tag">${q.ai ? `✦ Wrong answers written by ${MODEL_LABEL}` : "Wrong answers pulled from your other cards"}</p>`;

    app.querySelectorAll(".option").forEach((b) => b.addEventListener("click", () => choose(Number(b.dataset.i))));
    const next = app.querySelector("#next");
    next?.addEventListener("click", advance);
    next?.focus({ preventScroll: true });
  };

  const choose = (i) => {
    const q = t.questions[t.i];
    if (q.chosen !== null || !q.options[i]) return;
    q.chosen = i;
    if (q.options[i] === q.answer) t.score++;
    drawQuestion();
  };

  const advance = () => {
    if (t.questions[t.i]?.chosen === null) return;
    t.i++;
    if (t.i < t.questions.length) return drawQuestion();

    // Missed cards go back into the "still learning" pile.
    const missed = t.questions.filter((q) => q.options[q.chosen] !== q.answer);
    missed.forEach((q) => (q.card.status = "learning"));
    persist();
    t.phase = "done";
    draw();
    window.scrollTo(0, 0);
  };

  const drawDone = () => {
    const total = t.questions.length;
    const pct = Math.round((t.score / total) * 100);
    const missed = t.questions.filter((q) => q.options[q.chosen] !== q.answer);
    const verdict = pct === 100 ? "Perfect score." : pct >= 80 ? "Great work." : pct >= 50 ? "Getting there." : "Keep practicing.";
    app.innerHTML = `${header()}
      <section class="result">
        <p class="big">${t.score}/${total}</p>
        <p class="sub">${pct}% correct. ${verdict}</p>
        <div class="actions">
          <button class="btn btn-primary" type="button" id="retake">Retake test</button>
          <a class="btn btn-soft" href="#/deck/${deck.id}/study">Study flashcards</a>
          <a class="btn btn-ghost" href="#/">All decks</a>
        </div>
      </section>
      ${
        missed.length
          ? `<section class="missed">
              <h2>Review what you missed</h2>
              <p class="hint" style="color:var(--ink-2);margin-bottom:12px">These cards are now marked Still learning.</p>
              <ul>${missed
                .map(
                  (q) => `
                <li>
                  <p class="m-prompt">${esc(q.prompt)}</p>
                  <p class="m-answer">✓ ${esc(q.answer)}</p>
                  <p class="m-picked"><span class="visually-hidden">You picked: </span>${esc(q.options[q.chosen])}</p>
                </li>`,
                )
                .join("")}</ul>
            </section>`
          : ""
      }`;
    app.querySelector("#retake").addEventListener("click", () => {
      t.phase = "setup";
      t.notice = "";
      draw();
    });
  };

  const onKey = (e) => {
    if (t.phase !== "question" || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    const q = t.questions[t.i];
    if (/^[1-9]$/.test(e.key) && q.chosen === null) choose(Number(e.key) - 1);
    else if (e.key === "Enter" && q.chosen !== null && e.target.id !== "next") {
      e.preventDefault();
      advance();
    }
  };
  document.addEventListener("keydown", onKey);
  cleanup = () => {
    alive = false;
    document.removeEventListener("keydown", onKey);
  };

  draw();
}

// ---------- Settings ----------

function renderSettings() {
  setTitle("Settings");
  const cached = Object.keys(state.distractors).length;
  app.innerHTML = `
    <header class="page-head"><div><h1>Settings</h1></div></header>
    <section class="panel" aria-labelledby="data-heading">
      <h2 id="data-heading">Your data</h2>
      <p>Decks and progress are saved in this browser only. Clearing your browser's site data erases them.</p>
      <p>In Test mode, ${MODEL_LABEL} writes the wrong answers. They're saved so repeat tests are instant. ${plural(cached, "question")} saved.</p>
      <div class="row"><button class="btn btn-ghost" type="button" id="clear-cache" ${cached ? "" : "disabled"}>Clear saved AI answers</button></div>
    </section>`;

  app.querySelector("#clear-cache").addEventListener("click", () => {
    state.distractors = {};
    persist();
    toast("Saved AI answers cleared");
    renderSettings();
  });
}

route();
