import { state, persist, recordAnswer } from "../store.js";
import { esc, plural, shuffle, hash, normalize, isTyping } from "../util.js";
import { app, setTitle, view, deckHeader } from "../ui.js";
import { writeWrongAnswers, MODEL_LABEL } from "../ai.js";

const MODES = {
  term: { title: "Show term", desc: "Pick the matching definition" },
  definition: { title: "Show definition", desc: "Pick the matching term" },
  mix: { title: "Mix it up", desc: "A bit of both, at random" },
};

export function renderTest(deck) {
  setTitle(`${deck.name} test`);
  const t = { phase: "setup", mode: "term", questions: [], i: 0, score: 0, notice: "" };
  let alive = true;

  const header = (right = "") => deckHeader(deck, "test", right);

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
    app.innerHTML = `${header()}
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
    const correct = q.options[i] === q.answer;
    if (correct) t.score++;
    recordAnswer(q.card, correct);
    persist();
    drawQuestion();
  };

  const advance = () => {
    if (t.questions[t.i]?.chosen === null) return;
    t.i++;
    if (t.i < t.questions.length) return drawQuestion();

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
  view.cleanup = () => {
    alive = false;
    document.removeEventListener("keydown", onKey);
  };

  draw();
}
