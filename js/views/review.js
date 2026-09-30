// Today's review: cards due across every deck, in rounds of ROUND_SIZE.
// A missed card comes back once more at the end of the round.

import { state, persist, recordAnswer, shortcutsOn } from "../store.js";
import { esc, plural, isTyping } from "../util.js";
import { app, setTitle, view, announce } from "../ui.js";
import { dueCards, dayKey, ROUND_SIZE } from "../srs.js";
import { subjectOf } from "../subjects.js";
import { flipCardHTML, setFlipped, attachSwipe, bindSpeak, bindHint, UNDO_BUTTON } from "../flipcard.js";
import { hydrateImages } from "../images.js";

export function renderReview() {
  setTitle("Today's review");
  const r = { queue: [], requeued: new Set(), i: 0, flipped: false, tally: { known: 0, learning: 0 }, total: 0 };
  let lastUndo = null;

  const startRound = () => {
    r.queue = dueCards(state.decks, dayKey()).slice(0, ROUND_SIZE);
    r.total = r.queue.length;
    r.requeued = new Set();
    r.i = 0;
    r.flipped = false;
    r.tally = { known: 0, learning: 0 };
    lastUndo = null;
    draw();
  };

  const header = `
    <header class="page-head">
      <div>
        <a class="back" href="#/">← Decks</a>
        <h1>Today's review</h1>
      </div>
    </header>`;

  const draw = () => {
    if (!r.queue.length && r.i === 0) {
      app.innerHTML = `${header}
        <section class="result">
          <h2 class="big">All caught up</h2>
          <p class="sub">Nothing is due right now. Cards you study come back here when it's time to review them.</p>
          <div class="actions"><a class="btn btn-primary" href="#/">Back to decks</a></div>
        </section>`;
      return;
    }

    if (r.i >= r.queue.length) {
      const left = dueCards(state.decks, dayKey()).length;
      app.innerHTML = `${header}
        <section class="result">
          <h2 class="big">${left ? "Round done" : "All caught up"}</h2>
          <p class="sub">${left ? `${plural(left, "card")} still due today.` : "You reviewed everything due today. See you tomorrow."}</p>
          <div class="tallies">
            <div class="tally know"><strong>${r.tally.known}</strong>Know it</div>
            <div class="tally learn"><strong>${r.tally.learning}</strong>Still learning</div>
          </div>
          ${lastUndo ? UNDO_BUTTON : ""}
          <div class="actions">
            ${left ? `<button class="btn btn-primary" type="button" id="next-round">Keep going · ${plural(Math.min(left, ROUND_SIZE), "card")}</button>` : ""}
            <a class="btn ${left ? "btn-soft" : "btn-primary"}" href="#/">Back to decks</a>
          </div>
        </section>`;
      app.querySelector("#next-round")?.addEventListener("click", startRound);
      app.querySelector("#undo")?.addEventListener("click", undoLast);
      return;
    }

    const { deck, card } = r.queue[r.i];
    const subject = subjectOf(deck);
    // Missed cards come back after the round; count them separately so the
    // progress bar never moves backwards.
    const retrying = r.i >= r.total;
    const label = retrying ? `Retry ${r.i - r.total + 1} / ${r.queue.length - r.total}` : `${r.i + 1} / ${r.total}`;
    app.innerHTML = `${header}
      <div class="progress">
        <div class="progress-track"><span style="width:${Math.min(1, r.i / r.total) * 100}%"></span></div>
        <span class="progress-label">${label}</span>
      </div>
      ${flipCardHTML({
        card,
        deck,
        canUndo: Boolean(lastUndo),
        flipped: r.flipped,
        topLeft: `<span class="deck-context" data-subject="${subject.id}"><span class="subject-dot" aria-hidden="true"></span>${esc(deck.name)}</span>`,
      })}`;

    const flipBtn = app.querySelector("#flip");
    flipBtn.addEventListener("click", flip);
    attachSwipe(flipBtn, { onLeft: () => mark(false), onRight: () => mark(true) });
    bindSpeak(app, { deck, card, front: "term", isFlipped: () => r.flipped });
    bindHint(app);
    hydrateImages(app);
    app.querySelector("#undo")?.addEventListener("click", undoLast);
    app.querySelectorAll("[data-mark]").forEach((b) => b.addEventListener("click", () => mark(b.dataset.mark === "known")));
  };

  const flip = () => {
    if (!app.querySelector("#flip")) return;
    r.flipped = !r.flipped;
    setFlipped(app, r.flipped);
  };

  const mark = (correct) => {
    if (r.i >= r.queue.length) return;
    const item = r.queue[r.i];
    lastUndo = { undo: recordAnswer(item.card, correct, undefined, item.deck), key: correct ? "known" : "learning", requeued: false, id: item.card.id };
    persist();
    r.tally[correct ? "known" : "learning"]++;
    if (!correct && !r.requeued.has(item.card.id)) {
      r.requeued.add(item.card.id);
      r.queue.push(item);
      lastUndo.requeued = true;
    }
    r.i++;
    r.flipped = false;
    draw();
    app.querySelector("#flip")?.focus();
  };

  const undoLast = () => {
    if (!lastUndo || r.i === 0) return;
    lastUndo.undo();
    persist();
    r.tally[lastUndo.key]--;
    if (lastUndo.requeued) {
      r.queue.pop();
      r.requeued.delete(lastUndo.id);
    }
    r.i--;
    r.flipped = false;
    lastUndo = null;
    draw();
    announce("Undone. Back to the last card.");
    app.querySelector("#flip")?.focus();
  };

  const onKey = (e) => {
    if (!shortcutsOn() || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "ArrowRight") mark(true);
    else if (e.key === "ArrowLeft") mark(false);
    else if ((e.key === " " || e.key === "Enter") && (e.target === document.body || e.target === app)) {
      e.preventDefault();
      flip();
    }
  };
  document.addEventListener("keydown", onKey);
  view.cleanup = () => document.removeEventListener("keydown", onKey);

  startRound();
}
