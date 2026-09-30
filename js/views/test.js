// Practice test: pick how many questions, which types (multiple choice,
// written, true/false), and which side is shown. Claude writes the wrong
// answers for choice and true/false; other cards fill in when it can't.

import { state, persist, recordAnswer } from "../store.js";
import { esc, plural, hash, isTyping } from "../util.js";
import { app, setTitle, view, deckHeader } from "../ui.js";
import { writeWrongAnswers, MODEL_LABEL } from "../ai.js";
import { TYPES, buildQuestions, wrongAnswersFor, makeTrueFalse } from "../testbuilder.js";
import { checkAnswer, countsAsCorrect, needsAccentKeys, ACCENT_KEYS } from "../answer.js";
import { shuffle } from "../util.js";

const SHOWS = { term: "Show term", definition: "Show definition", mix: "Mix" };
const COUNTS = [10, 20, 0]; // 0 = every card
const LABEL = { term: "Term", definition: "Definition" };

export function renderTest(deck) {
  setTitle(`${deck.name} test`);
  const saved = state.settings.test ?? {};
  const t = {
    phase: "setup",
    mode: SHOWS[saved.mode] ? saved.mode : "term",
    count: COUNTS.includes(saved.count) ? saved.count : 20,
    types: Array.isArray(saved.types) && saved.types.every((x) => TYPES[x]) && saved.types.length ? saved.types : ["choice"],
    questions: [],
    i: 0,
    score: 0,
    notice: "",
  };
  let alive = true;

  const header = (right = "") => deckHeader(deck, "test", right);
  const questionCount = () => (t.count ? Math.min(t.count, deck.cards.length) : deck.cards.length);

  const draw = () => {
    if (t.phase === "setup") return drawSetup();
    if (t.phase === "loading") {
      app.innerHTML = `${header()}
        <section class="loading" aria-live="polite">
          <div class="loader" aria-hidden="true"><span></span><span></span><span></span></div>
          <h2>Writing tricky wrong answers…</h2>
          <p>${MODEL_LABEL} is making believable choices for your test.</p>
        </section>`;
      return;
    }
    if (t.phase === "question") return drawQuestion();
    drawDone();
  };

  const drawSetup = () => {
    const n = deck.cards.length;
    const aiTypes = t.types.some((x) => TYPES[x].needsWrong);
    app.innerHTML = `${header()}
      ${t.notice ? `<div class="notice warn" role="alert">${esc(t.notice)}</div>` : ""}
      <div class="setup">
        <div class="setup-row">
          <p class="setup-label" id="count-label">Questions</p>
          <div class="seg" role="group" aria-labelledby="count-label">
            ${COUNTS.filter((c) => c === 0 || c < n)
              .map((c) => `<button type="button" data-count="${c}" aria-pressed="${t.count === c || (c === 0 && t.count >= n)}">${c ? c : `All ${n}`}</button>`)
              .join("")}
          </div>
        </div>
        <div class="setup-row">
          <p class="setup-label" id="types-label">Question types</p>
          <div class="chips" role="group" aria-labelledby="types-label">
            ${Object.entries(TYPES)
              .map(
                ([key, type]) => `
              <label class="chip-check">
                <input type="checkbox" value="${key}" ${t.types.includes(key) ? "checked" : ""}>
                <span>${type.label}</span>
              </label>`,
              )
              .join("")}
          </div>
        </div>
        <div class="setup-row">
          <p class="setup-label" id="shows-label">Each question shows</p>
          <div class="seg" role="group" aria-labelledby="shows-label">
            ${Object.entries(SHOWS)
              .map(([key, label]) => `<button type="button" data-mode="${key}" aria-pressed="${t.mode === key}">${label}</button>`)
              .join("")}
          </div>
        </div>
      </div>
      ${aiTypes ? `<div class="notice ai"><span class="spark" aria-hidden="true">✦</span><span>${MODEL_LABEL} writes believable wrong answers for multiple choice and true or false.</span></div>` : ""}
      <div class="row">
        <button class="btn btn-primary btn-lg" type="button" id="start" ${n ? "" : "disabled"}>Start test · ${plural(questionCount(), "question")}</button>
        ${n ? "" : `<span class="hint">Add some cards to this deck first.</span>`}
      </div>`;

    app.querySelectorAll("[data-count]").forEach((b) =>
      b.addEventListener("click", () => {
        t.count = Number(b.dataset.count);
        drawSetup();
      }),
    );
    app.querySelectorAll("[data-mode]").forEach((b) =>
      b.addEventListener("click", () => {
        t.mode = b.dataset.mode;
        drawSetup();
      }),
    );
    app.querySelectorAll(".chip-check input").forEach((box) =>
      box.addEventListener("change", () => {
        const next = [...app.querySelectorAll(".chip-check input:checked")].map((x) => x.value);
        if (!next.length) {
          box.checked = true; // keep at least one type
          return;
        }
        t.types = next;
        drawSetup();
        app.querySelector(`.chip-check input[value="${box.value}"]`)?.focus();
      }),
    );
    app.querySelector("#start").addEventListener("click", start);
  };

  const cacheKey = (q) => `${q.shows}:${hash(q.prompt)}:${hash(q.answer)}`;

  const start = async () => {
    state.settings.test = { mode: t.mode, count: t.count, types: t.types };
    persist();
    t.notice = "";
    t.i = 0;
    t.score = 0;
    t.questions = buildQuestions(deck.cards, { count: questionCount(), mode: t.mode, types: t.types }).map((q) => ({
      ...q,
      picked: null, // choice/truefalse: the option chosen; written: typed text
      result: null, // written: checkAnswer() result
      overruled: false,
      done: false,
    }));

    const missing = t.questions.filter((q) => TYPES[q.type].needsWrong && !state.distractors[cacheKey(q)]);
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
      if (!TYPES[q.type].needsWrong) continue;
      const fromAi = state.distractors[cacheKey(q)] ?? [];
      const wrong = wrongAnswersFor(q, fromAi, deck.cards);
      q.ai = fromAi.length > 0;
      if (q.type === "choice") q.options = shuffle([q.answer, ...wrong]);
      else Object.assign(q, makeTrueFalse(q, wrong));
      // A choice question needs at least one wrong answer; fall back to written.
      if (q.type === "choice" && q.options.length < 2) q.type = "written";
    }
    t.phase = "question";
    draw();
  };

  const isCorrect = (q) => {
    if (q.type === "choice") return q.picked === q.answer;
    if (q.type === "truefalse") return q.picked === q.isTrue;
    return q.overruled || countsAsCorrect(q.result?.verdict);
  };

  const drawQuestion = () => {
    const q = t.questions[t.i];
    const answered = q.type === "written" ? q.result !== null : q.picked !== null;
    const last = t.i === t.questions.length - 1;
    const right = answered && isCorrect(q);

    let body = "";
    if (q.type === "choice") {
      body = `
        <p class="q-instruction" id="q-instruction">Pick the matching ${other(q.shows)}</p>
        <div class="options" role="group" aria-labelledby="q-instruction">
          ${q.options
            .map((opt, i) => {
              const cls = !answered ? "" : opt === q.answer ? "is-correct" : opt === q.picked ? "is-wrong" : "dim";
              return `<button type="button" class="option ${cls}" data-pick="${i}" ${answered ? "disabled" : ""}>
                <span class="opt-key" aria-hidden="true">${i + 1}</span><span class="opt-text">${esc(opt)}</span></button>`;
            })
            .join("")}
        </div>`;
    } else if (q.type === "truefalse") {
      const cls = (value) => (!answered ? "" : value === q.isTrue ? "is-correct" : value === q.picked ? "is-wrong" : "dim");
      body = `
        <p class="q-instruction" id="q-instruction">True or false: this is the matching ${other(q.shows)}</p>
        <p class="tf-statement">${esc(q.statement)}</p>
        <div class="options tf" role="group" aria-labelledby="q-instruction">
          <button type="button" class="option ${cls(true)}" data-tf="true" ${answered ? "disabled" : ""}><span class="opt-key" aria-hidden="true">T</span><span class="opt-text">True</span></button>
          <button type="button" class="option ${cls(false)}" data-tf="false" ${answered ? "disabled" : ""}><span class="opt-key" aria-hidden="true">F</span><span class="opt-text">False</span></button>
        </div>`;
    } else {
      const accents = needsAccentKeys(q.answer, deck.subject);
      body = `
        <form class="write-form" novalidate>
          <label class="field">
            <span class="field-label">Type the ${other(q.shows)}</span>
            <input class="input write-input" id="answer" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" value="${esc(q.picked ?? "")}" ${answered ? "readonly" : ""}>
          </label>
          ${accents && !answered ? `<div class="accent-keys" role="group" aria-label="Insert accented letter">${ACCENT_KEYS.map((k) => `<button type="button" class="accent-key" data-char="${k}">${k}</button>`).join("")}</div>` : ""}
          ${answered ? "" : `<div class="row"><button class="btn btn-primary" type="submit">Check <kbd>Enter</kbd></button><button class="btn btn-ghost" type="button" id="dont-know">I don't know</button></div>`}
        </form>`;
    }

    const feedback = !answered
      ? ""
      : right
        ? q.type === "written" && q.result.verdict === "accent"
          ? `Correct! Watch the accents: <strong>${esc(q.answer)}</strong>`
          : "Correct!"
        : q.type === "truefalse"
          ? `Not quite. It's ${q.isTrue ? "true" : `false. The answer is <strong>${esc(q.answer)}</strong>`}.`
          : `Not quite. The answer is <strong>${esc(q.answer)}</strong>.`;

    app.innerHTML = `${header(`<span class="progress-label">Score ${t.score}</span>`)}
      ${t.notice ? `<div class="notice warn" role="alert">${esc(t.notice)}</div>` : ""}
      <div class="progress">
        <div class="progress-track"><span style="width:${((t.i + (answered ? 1 : 0)) / t.questions.length) * 100}%"></span></div>
        <span class="progress-label">${t.i + 1} / ${t.questions.length}</span>
      </div>
      <section class="q-card ${q.shows === "definition" ? "def" : ""}" aria-labelledby="q-prompt">
        <span class="face-label">${LABEL[q.shows]}</span>
        <span class="q-type">${TYPES[q.type].label}</span>
        <p class="q-prompt" id="q-prompt">${esc(q.prompt)}</p>
      </section>
      ${body}
      <div class="q-foot">
        <p class="feedback ${answered ? (right ? "good" : "bad") : ""}" aria-live="polite">${feedback}</p>
        ${
          answered
            ? `<div class="row">
                ${q.type === "written" && !right && q.picked?.trim() ? `<button class="btn btn-ghost" type="button" id="overrule">I was right</button>` : ""}
                <button class="btn btn-primary" type="button" id="next">${last ? "See results" : "Next question"} <kbd>Enter</kbd></button>
              </div>`
            : ""
        }
      </div>
      ${TYPES[q.type].needsWrong ? `<p class="source-tag">${q.ai ? `✦ Wrong answers written by ${MODEL_LABEL}` : "Wrong answers pulled from your other cards"}</p>` : ""}`;

    app.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => pick(q.options[Number(b.dataset.pick)])));
    app.querySelectorAll("[data-tf]").forEach((b) => b.addEventListener("click", () => pick(b.dataset.tf === "true")));
    const form = app.querySelector(".write-form");
    if (form) {
      const input = app.querySelector("#answer");
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!answered) writeAnswer(input.value);
      });
      app.querySelector("#dont-know")?.addEventListener("click", () => writeAnswer(""));
      app.querySelectorAll(".accent-key").forEach((b) =>
        b.addEventListener("click", () => {
          const { selectionStart: s, selectionEnd: e, value } = input;
          input.value = value.slice(0, s) + b.dataset.char + value.slice(e);
          input.focus();
          input.setSelectionRange(s + 1, s + 1);
        }),
      );
      if (!answered) input.focus({ preventScroll: true });
    }
    app.querySelector("#overrule")?.addEventListener("click", () => {
      q.overruled = true;
      t.score++;
      advance();
    });
    const next = app.querySelector("#next");
    next?.addEventListener("click", advance);
    next?.focus({ preventScroll: true });
  };

  const pick = (value) => {
    const q = t.questions[t.i];
    if (q.picked !== null) return;
    q.picked = value;
    if (isCorrect(q)) t.score++;
    drawQuestion();
  };

  const writeAnswer = (typed) => {
    const q = t.questions[t.i];
    q.picked = typed;
    q.result = checkAnswer(typed, q.answer);
    if (isCorrect(q)) t.score++;
    drawQuestion();
  };

  // The grade is saved when moving on, so "I was right" can still change it.
  const advance = () => {
    const q = t.questions[t.i];
    const answered = q.type === "written" ? q.result !== null : q.picked !== null;
    if (!answered || q.done) return;
    q.done = true;
    recordAnswer(q.card, isCorrect(q), undefined, deck);
    persist();
    t.i++;
    if (t.i < t.questions.length) return drawQuestion();
    t.phase = "done";
    draw();
    window.scrollTo(0, 0);
  };

  const yourAnswer = (q) => {
    if (q.type === "truefalse") return q.picked ? "True" : "False";
    return q.picked ?? "";
  };

  const drawDone = () => {
    const total = t.questions.length;
    const pct = Math.round((t.score / total) * 100);
    const missed = t.questions.filter((q) => !isCorrect(q));
    const verdict = pct === 100 ? "Perfect score." : pct >= 80 ? "Great work." : pct >= 50 ? "Getting there." : "Keep practicing.";
    app.innerHTML = `${header()}
      <section class="result">
        <p class="big">${t.score}/${total}</p>
        <p class="sub">${pct}% correct. ${verdict}</p>
        <div class="actions">
          <button class="btn btn-primary" type="button" id="retake">New test</button>
          ${missed.length ? `<a class="btn btn-soft" href="#/review">Review missed cards</a>` : ""}
          <a class="btn btn-ghost" href="#/">All decks</a>
        </div>
      </section>
      ${
        missed.length
          ? `<section class="missed">
              <h2>Review what you missed</h2>
              <p class="hint" style="color:var(--ink-2);margin-bottom:12px">These cards are back in today's review.</p>
              <ul>${missed
                .map(
                  (q) => `
                <li>
                  <p class="m-prompt">${esc(q.prompt)}</p>
                  <p class="m-answer">✓ ${esc(q.answer)}</p>
                  ${yourAnswer(q) ? `<p class="m-picked"><span class="visually-hidden">You answered: </span>${esc(q.type === "truefalse" ? `${yourAnswer(q)}: ${q.statement}` : yourAnswer(q))}</p>` : ""}
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
    const unanswered = q.picked === null && q.result === null;
    if (q.type === "choice" && unanswered && /^[1-9]$/.test(e.key) && q.options[Number(e.key) - 1] !== undefined) pick(q.options[Number(e.key) - 1]);
    else if (q.type === "truefalse" && unanswered && /^[tf12]$/i.test(e.key)) pick(/^[t1]$/i.test(e.key));
    else if (e.key === "Enter" && !unanswered && e.target.id !== "next" && e.target.id !== "overrule") {
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

const other = (side) => (side === "term" ? "definition" : "term");
