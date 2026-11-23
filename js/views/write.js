// Write mode: see one side, type the other. Rounds of ROUND_SIZE cards,
// cards she doesn't know yet first. Answers are graded leniently (js/answer.js)
// and she can overrule the grade with "I was right".
// "Explain it" (Teach It Back) shows the term and she explains it in her own
// words; Claude says what she got right, what's missing, and asks a follow-up.

import { persist, recordAnswer, shortcutsOn } from "../store.js";
import { esc, plural, shuffle, isTyping } from "../util.js";
import { app, setTitle, view, deckHeader, announce, keepFocus } from "../ui.js";
import { ROUND_SIZE } from "../srs.js";
import { checkAnswer, countsAsCorrect, needsAccentKeys, ACCENT_KEYS } from "../answer.js";
import { canSpeak, speak, langFor, SPEAKER_ICON } from "../speech.js";
import { bindHint } from "../flipcard.js";
import { imageSlot, hydrateImages } from "../images.js";
import { explainButtonHTML, bindExplain } from "../explain.js";
import { findMixup, noteMixup, mixupMessage } from "../mixups.js";
import { teachBack, MODEL_LABEL, MAX_EXPLANATION } from "../ai.js";

// Explaining takes longer than typing a word, so those rounds are shorter.
const EXPLAIN_ROUND = 5;
const VERDICT_LABEL = { got_it: "Got it", partly: "Partly there", not_yet: "Not yet" };

const LABEL = { term: "Term", definition: "Definition" };

export function renderWrite(deck) {
  setTitle(`${deck.name} · Write`);
  const w = { typeSide: "term", onlyLearning: false, queue: [], i: 0, result: null, score: 0, missed: [], pool: [], teach: null };
  const explaining = () => w.typeSide === "explain";
  const roundSize = () => (explaining() ? EXPLAIN_ROUND : ROUND_SIZE);
  // The side shown as the answer in results ("explain" shows the definition).
  const answerSide = () => (explaining() ? "definition" : w.typeSide);

  const buildPool = () => {
    const cards = w.onlyLearning ? deck.cards.filter((c) => c.status !== "known") : deck.cards;
    // Unknown cards first, each group shuffled.
    return [...shuffle(cards.filter((c) => c.status !== "known")), ...shuffle(cards.filter((c) => c.status === "known"))];
  };

  // restPool: cards still to come after this round (kept when retrying misses).
  const startRound = (cards, restPool = null) => {
    w.queue = cards.slice(0, roundSize());
    w.pool = restPool ?? cards.slice(roundSize());
    w.teach = null;
    w.i = 0;
    w.result = null;
    w.score = 0;
    w.missed = [];
    draw();
  };
  const restart = () => startRound(buildPool());

  const header = deckHeader(deck, "write");

  const toolbar = () => {
    const notKnown = deck.cards.filter((c) => c.status !== "known").length;
    return `
      <div class="toolbar">
        <div class="seg" role="group" aria-label="What you write">
          <button type="button" data-type="term" aria-pressed="${w.typeSide === "term"}"><span class="visually-hidden">Type the </span>Term</button>
          <button type="button" data-type="definition" aria-pressed="${w.typeSide === "definition"}"><span class="visually-hidden">Type the </span>Definition</button>
          <button type="button" data-type="explain" aria-pressed="${w.typeSide === "explain"}"><span aria-hidden="true">✦ </span>Explain it</button>
        </div>
        <div class="seg" role="group" aria-label="Which cards">
          <button type="button" data-only="all" aria-pressed="${!w.onlyLearning}">All (${deck.cards.length})</button>
          <button type="button" data-only="learning" aria-pressed="${w.onlyLearning}" ${notKnown ? "" : "disabled"}>Not known yet (${notKnown})</button>
        </div>
      </div>`;
  };

  const bindToolbar = () => {
    app.querySelectorAll("[data-type]").forEach((b) =>
      b.addEventListener("click", () => {
        w.typeSide = b.dataset.type;
        restart();
      }),
    );
    app.querySelectorAll("[data-only]").forEach((b) =>
      b.addEventListener("click", () => {
        w.onlyLearning = b.dataset.only === "learning";
        restart();
      }),
    );
  };

  const draw = () => {
    if (!deck.cards.length) {
      app.innerHTML = `${header}
        <div class="result"><p class="sub">This deck has no cards yet.</p>
        <div class="actions"><a class="btn btn-primary" href="#/deck/${deck.id}/edit">Add cards</a></div></div>`;
      return;
    }
    if (!w.queue.length) {
      app.innerHTML = `${header}${toolbar()}
        <div class="result"><p class="sub">You know every card in this deck. Switch to All to keep practicing.</p></div>`;
      bindToolbar();
      return;
    }
    if (w.i >= w.queue.length) return drawDone();
    if (explaining()) return drawExplain();

    const card = w.queue[w.i];
    const showSide = w.typeSide === "term" ? "definition" : "term";
    const expected = card[w.typeSide];
    const r = w.result;
    const accents = needsAccentKeys(expected, deck.subject);
    const long = expected.length > 40;

    app.innerHTML = `${header}${toolbar()}
      <div class="progress">
        <div class="progress-track"><span style="width:${((w.i + (r ? 1 : 0)) / w.queue.length) * 100}%"></span></div>
        <span class="progress-label">${w.i + 1} / ${w.queue.length}</span>
      </div>
      <section class="q-card ${showSide === "definition" ? "def" : ""}" aria-labelledby="w-prompt">
        <span class="face-label">${LABEL[showSide]}</span>
        ${card.image?.side === showSide ? imageSlot(card.image) : ""}
        <p class="q-prompt" id="w-prompt"${langAttr(deck, showSide, card[showSide])}>${esc(card[showSide])}</p>
      </section>
      <form class="write-form" novalidate>
        <label class="field">
          <span class="field-label">Type the ${w.typeSide}</span>
          ${
            long
              ? `<textarea class="input write-input" id="answer" aria-describedby="w-prompt" rows="3" autocomplete="off" autocapitalize="off" spellcheck="false" ${r ? "readonly" : ""}>${esc(r?.typed ?? "")}</textarea>`
              : `<input class="input write-input" id="answer" aria-describedby="w-prompt" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" value="${esc(r?.typed ?? "")}" ${r ? "readonly" : ""}>`
          }
        </label>
        ${
          accents && !r
            ? `<div class="accent-keys" role="group" aria-label="Insert accented letter">${ACCENT_KEYS.map((k) => `<button type="button" class="accent-key" data-char="${k}">${k}</button>`).join("")}</div>`
            : ""
        }
        ${
          r
            ? feedbackHTML(r, expected)
            : `<div class="row write-actions">
                <button class="btn btn-primary" type="submit">Check <kbd>Enter</kbd></button>
                <button class="btn btn-ghost" type="button" id="dont-know">I don't know</button>
              </div>
              ${card.hint ? `<div class="hint-box"><button class="text-btn" type="button" id="show-hint" aria-expanded="false" aria-controls="hint-text">💡 Show hint</button><p class="hint-text" id="hint-text" hidden>${esc(card.hint)}</p></div>` : ""}`
        }
      </form>`;

    bindToolbar();
    const form = app.querySelector(".write-form");
    const input = app.querySelector("#answer");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (w.result) advance();
      else check(input.value);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && input.tagName === "TEXTAREA") {
        e.preventDefault();
        form.requestSubmit();
      }
    });
    app.querySelector("#dont-know")?.addEventListener("click", () => check(""));
    bindHint(app);
    hydrateImages(app);
    bindExplain(app, { deck, card });
    app.querySelectorAll(".accent-key").forEach((b) =>
      b.addEventListener("click", () => {
        const { selectionStart: s, selectionEnd: e, value } = input;
        input.value = value.slice(0, s) + b.dataset.char + value.slice(e);
        input.focus();
        input.setSelectionRange(s + 1, s + 1);
      }),
    );
    app.querySelector("#hear")?.addEventListener("click", () => speak(expected, langFor(deck, w.typeSide, expected)));
    app.querySelector("#overrule")?.addEventListener("click", () => {
      w.result.overruled = true;
      advance();
    });
    const next = app.querySelector("#next");
    if (next) next.focus();
    else input.focus();
  };

  const feedbackHTML = (r, expected) => {
    const right = countsAsCorrect(r.verdict);
    const messages = {
      correct: "Correct!",
      accent: "Correct! Watch the accents:",
      almost: "Almost. Check the spelling:",
      wrong: "Not quite. The answer is:",
      empty: "The answer is:",
    };
    return `
      <div class="write-feedback ${right ? "good" : "bad"}" role="status">
        <p class="feedback ${right ? "good" : "bad"}">${messages[r.verdict]}</p>
        ${r.verdict !== "correct" ? `<p class="expected"${langAttr(deck, w.typeSide, expected)}>${esc(expected)}</p>` : ""}
        ${canSpeak() ? `<button type="button" class="text-btn hear" id="hear">${SPEAKER_ICON}<span>Hear it</span></button>` : ""}
        ${right ? "" : explainButtonHTML()}
        ${!right && r.typed.trim() ? `<p class="typed"><span class="visually-hidden">You wrote: </span>${esc(r.typed)}</p>` : ""}
        ${!right && r.mixup ? `<p class="mixup-note">${mixupMessage(r.mixup, w.typeSide)} Added to your mix-ups.</p>` : ""}
      </div>
      <div class="row write-actions">
        <button class="btn btn-primary" type="submit" id="next">${w.i === w.queue.length - 1 ? "See results" : "Next"} <kbd>Enter</kbd></button>
        ${!right && r.typed.trim() ? `<button class="btn btn-ghost" type="button" id="overrule">I was right</button>` : ""}
      </div>`;
  };

  const check = (typed) => {
    const card = w.queue[w.i];
    w.result = { typed, ...checkAnswer(typed, card[w.typeSide]) };
    if (!countsAsCorrect(w.result.verdict)) w.result.mixup = findMixup(deck, card, w.typeSide, typed, { typed: true });
    draw();
    const expected = card[w.typeSide];
    announce(
      {
        correct: "Correct!",
        accent: `Correct! Watch the accents: ${expected}`,
        almost: `Almost. The answer is ${expected}`,
        wrong: `Not quite. The answer is ${expected}`,
        empty: `The answer is ${expected}`,
      }[w.result.verdict],
    );
  };

  // The grade is saved when moving on, so "I was right" can still change it.
  const advance = () => {
    const card = w.queue[w.i];
    const r = w.result;
    const correct = r.overruled || countsAsCorrect(r.verdict);
    // Write only notes mix-ups. Counting them down needs both cards in front
    // of her (Test choices or the mix-up drill).
    if (!correct && r.mixup) noteMixup(card, r.mixup);
    recordAnswer(card, correct, undefined, deck);
    persist();
    if (correct) w.score++;
    else w.missed.push({ card, typed: r.typed, mixup: r.mixup });
    w.i++;
    w.result = null;
    draw();
  };

  const drawDone = () => {
    const total = w.queue.length;
    const pct = Math.round((w.score / total) * 100);
    app.innerHTML = `${header}
      <section class="result">
        <h2 class="big">${w.score}/${total}</h2>
        <p class="sub">${pct}% correct.${w.pool.length ? ` ${plural(w.pool.length, "card")} left in this deck.` : ""}</p>
        <div class="actions">
          ${w.missed.length ? `<button class="btn btn-primary" type="button" id="retry">Practice ${w.missed.length} missed again</button>` : ""}
          ${w.pool.length ? `<button class="btn ${w.missed.length ? "btn-soft" : "btn-primary"}" type="button" id="more">Next ${plural(Math.min(w.pool.length, roundSize()), "card")}</button>` : ""}
          <button class="btn btn-soft" type="button" id="again">Start over</button>
          <a class="btn btn-ghost" href="#/">All decks</a>
        </div>
      </section>
      ${
        w.missed.length
          ? `<section class="missed"><h2>To practice</h2><ul>${w.missed
              .map(
                ({ card, typed, mixup }) => `
            <li>
              <p class="m-prompt">${esc(card[answerSide() === "term" ? "definition" : "term"])}</p>
              <p class="m-answer">✓ ${esc(card[answerSide()])}</p>
              ${typed.trim() ? `<p class="m-picked"><span class="visually-hidden">You wrote: </span>${esc(typed)}</p>` : ""}
              ${mixup ? `<p class="m-mixup">${mixupMessage(mixup, w.typeSide)}</p>` : ""}
            </li>`,
              )
              .join("")}</ul></section>`
          : ""
      }`;
    app.querySelector("#retry")?.addEventListener("click", () => startRound(shuffle(w.missed.map((m) => m.card)), w.pool));
    app.querySelector("#more")?.addEventListener("click", () => startRound(w.pool));
    app.querySelector("#again").addEventListener("click", restart);
  };

  // ---------- Explain it (Teach It Back) ----------
  // w.teach: { phase: "write" | "loading" | "feedback" | "error", text, feedback,
  //            followText, followPhase, followFeedback, error, selfGraded }
  let alive = true;

  const teachState = () => (w.teach ??= { phase: "write", text: "", feedback: null, followText: "", followPhase: "idle", followFeedback: null, error: "", selfGraded: null });

  const teachFeedbackHTML = (f, { heading }) => `
    <div class="teach-feedback v-${f.verdict}">
      <p class="teach-verdict"><span class="teach-chip">${VERDICT_LABEL[f.verdict]}</span>${heading ? `<span class="visually-hidden"> ${heading}</span>` : ""}</p>
      ${f.summary ? `<p class="teach-summary">${esc(f.summary)}</p>` : ""}
      ${teachList("You got", "got", f.correct)}
      ${teachList("Missing", "missing", f.missing)}
      ${teachList("Not quite right", "wrong", f.wrong)}
    </div>`;
  const teachList = (title, cls, items) =>
    items.length ? `<div class="teach-list ${cls}"><p class="teach-list-title">${title}</p><ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "";

  const drawExplain = () => {
    const card = w.queue[w.i];
    const t = teachState();
    const done = t.phase === "feedback" || (t.phase === "error" && t.selfGraded !== null);
    const writing = t.phase === "write";
    const answerHTML = `<div class="teach-card"><p class="teach-list-title">The card says</p><p${langAttr(deck, "definition", card.definition)}>${esc(card.definition)}</p></div>`;

    let body;
    if (writing) {
      body = `
        <form class="write-form teach-form" novalidate>
          <label class="field">
            <span class="field-label">Explain it in your own words</span>
            <textarea class="input write-input" id="answer" aria-describedby="w-prompt teach-tip" rows="5" maxlength="${MAX_EXPLANATION}" autocomplete="off" spellcheck="true">${esc(t.text)}</textarea>
          </label>
          <p class="hint" id="teach-tip">Say what it means and why it matters, like you're teaching a friend. To talk instead of type, tap the mic on your keyboard.</p>
          <div class="row write-actions">
            <button class="btn btn-primary" type="submit"><span aria-hidden="true">✦ </span>Get feedback</button>
            <button class="btn btn-ghost" type="button" id="dont-know">I don't know</button>
          </div>
        </form>`;
    } else if (t.phase === "loading") {
      body = `
        <section class="loading" aria-live="polite">
          <div class="loader" aria-hidden="true"><span></span><span></span><span></span></div>
          <p>Reading your explanation…</p>
        </section>`;
    } else if (t.phase === "error") {
      body = `
        <div class="notice warn" role="alert">Couldn't get feedback: ${esc(t.error)}. Compare with the card yourself.</div>
        ${t.text.trim() ? `<div class="teach-yours"><p class="teach-list-title">You wrote</p><p>${esc(t.text)}</p></div>` : ""}
        ${answerHTML}
        ${
          t.selfGraded === null
            ? `<div class="row write-actions" role="group" aria-label="Did you have it?">
                <button class="btn btn-know" type="button" data-self="right">I had it</button>
                <button class="btn btn-learn" type="button" data-self="wrong">I didn't</button>
                <button class="btn btn-ghost" type="button" id="retry-teach">Try again</button>
              </div>`
            : ""
        }`;
    } else {
      const f = t.feedback;
      body = `
        <div class="teach-yours"><p class="teach-list-title">You wrote</p><p>${esc(t.text)}</p></div>
        <div role="status">${teachFeedbackHTML(f, { heading: "" })}</div>
        ${answerHTML}
        ${
          f.followUp
            ? `<section class="teach-follow" aria-labelledby="follow-q">
                <p class="teach-list-title">Go one step further</p>
                <p class="teach-question" id="follow-q">${esc(f.followUp)}</p>
                ${
                  t.followPhase === "done"
                    ? `<div class="teach-yours"><p class="teach-list-title">Your answer</p><p>${esc(t.followText)}</p></div><div role="status">${teachFeedbackHTML(t.followFeedback, { heading: "on your follow-up" })}</div>`
                    : t.followPhase === "loading"
                      ? `<p class="hint" aria-live="polite">Reading your answer…</p>`
                      : `<form class="teach-follow-form" novalidate>
                          <label class="visually-hidden" for="follow-answer">Your answer to the follow-up question</label>
                          <textarea class="input write-input" id="follow-answer" rows="3" maxlength="${MAX_EXPLANATION}" autocomplete="off" spellcheck="true">${esc(t.followText)}</textarea>
                          ${t.followPhase === "error" ? `<p class="hint" role="alert">Couldn't get feedback on that. You can try again or move on.</p>` : ""}
                          <div class="row"><button class="btn btn-soft" type="submit">Answer</button><span class="hint">Optional</span></div>
                        </form>`
                }
              </section>`
            : ""
        }`;
    }

    app.innerHTML = `${header}${toolbar()}
      <div class="progress">
        <div class="progress-track"><span style="width:${((w.i + (done ? 1 : 0)) / w.queue.length) * 100}%"></span></div>
        <span class="progress-label">${w.i + 1} / ${w.queue.length}</span>
      </div>
      <section class="q-card" aria-labelledby="w-prompt">
        <span class="face-label">Term</span>
        ${card.image?.side === "term" ? imageSlot(card.image) : ""}
        <p class="q-prompt" id="w-prompt"${langAttr(deck, "term", card.term)}>${esc(card.term)}</p>
      </section>
      ${body}
      ${done ? `<div class="row write-actions"><button class="btn btn-primary" type="button" id="next">${w.i === w.queue.length - 1 ? "See results" : "Next card"} <kbd>Enter</kbd></button></div>` : ""}
      ${writing ? "" : `<p class="source-tag">✦ Feedback from ${MODEL_LABEL}. Double-check with your notes or teacher.</p>`}`;

    bindToolbar();
    hydrateImages(app);
    const form = app.querySelector(".teach-form");
    if (form) {
      const input = app.querySelector("#answer");
      input.addEventListener("input", () => (t.text = input.value));
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        t.text = input.value;
        if (t.text.trim()) askFeedback();
        else input.focus();
      });
      app.querySelector("#dont-know").addEventListener("click", () => {
        t.text = "";
        t.feedback = { verdict: "not_yet", summary: "That's OK. Read the card, then try explaining it next time.", correct: [], missing: [], wrong: [], followUp: "" };
        t.phase = "feedback";
        drawExplain();
        app.querySelector("#next")?.focus();
      });
      input.focus();
    }
    app.querySelectorAll("[data-self]").forEach((b) =>
      b.addEventListener("click", () => {
        t.selfGraded = b.dataset.self === "right";
        drawExplain();
        app.querySelector("#next")?.focus();
      }),
    );
    app.querySelector("#retry-teach")?.addEventListener("click", askFeedback);
    const follow = app.querySelector(".teach-follow-form");
    if (follow) {
      const input = follow.querySelector("#follow-answer");
      input.addEventListener("input", () => (t.followText = input.value));
      follow.addEventListener("submit", (e) => {
        e.preventDefault();
        t.followText = input.value;
        if (t.followText.trim()) askFollowUp();
      });
    }
    app.querySelector("#next")?.addEventListener("click", advanceExplain);
  };

  const askFeedback = async () => {
    const card = w.queue[w.i];
    const t = teachState();
    t.phase = "loading";
    drawExplain();
    try {
      const feedback = await teachBack({ term: card.term, definition: card.definition, subject: deck.subject, explanation: t.text });
      if (!alive || w.teach !== t) return;
      t.feedback = feedback;
      t.phase = "feedback";
      drawExplain();
      announce(`${VERDICT_LABEL[feedback.verdict]}. ${feedback.summary}`);
      app.querySelector("#next")?.focus({ preventScroll: true });
    } catch (err) {
      if (!alive || w.teach !== t) return;
      t.error = err.message;
      t.phase = "error";
      t.selfGraded = null;
      drawExplain();
    }
  };

  const askFollowUp = async () => {
    const card = w.queue[w.i];
    const t = teachState();
    const question = t.feedback.followUp;
    t.followPhase = "loading";
    keepFocus(drawExplain);
    try {
      const feedback = await teachBack({ term: card.term, definition: card.definition, subject: deck.subject, explanation: t.followText, question });
      if (!alive || w.teach !== t) return;
      t.followFeedback = feedback;
      t.followPhase = "done";
      drawExplain();
      announce(`${VERDICT_LABEL[feedback.verdict]}. ${feedback.summary}`);
      app.querySelector("#next")?.focus({ preventScroll: true });
    } catch {
      if (!alive || w.teach !== t) return;
      t.followPhase = "error";
      drawExplain();
      app.querySelector("#follow-answer")?.focus();
    }
  };

  // Only "Got it" (or "I had it" when the service was down) counts as known.
  // The follow-up is extra practice and doesn't change the grade.
  const advanceExplain = () => {
    const card = w.queue[w.i];
    const t = teachState();
    const correct = t.phase === "feedback" ? t.feedback.verdict === "got_it" : t.selfGraded === true;
    recordAnswer(card, correct, undefined, deck);
    persist();
    if (correct) w.score++;
    else w.missed.push({ card, typed: "", mixup: null });
    w.i++;
    w.teach = null;
    draw();
  };

  const onKey = (e) => {
    if (!explaining() || !shortcutsOn() || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Enter" && app.querySelector("#next") && !e.target.closest?.("a, button, input, select, textarea")) {
      e.preventDefault();
      advanceExplain();
    }
  };
  document.addEventListener("keydown", onKey);

  view.cleanup = () => {
    alive = false;
    document.removeEventListener("keydown", onKey);
  };
  restart();
}

const langAttr = (deck, side, text) => (langFor(deck, side, text).startsWith("es") ? ' lang="es"' : "");
