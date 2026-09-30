// The flip card used by Flashcards and Review: markup, flipping, and swipe.

import { esc } from "./util.js";
import { canSpeak, speak, langFor, SPEAKER_ICON } from "./speech.js";

const LABEL = { term: "Term", definition: "Definition" };

export function flipCardHTML({ card, front = "term", flipped = false, topLeft = LABEL[front], topRight = "" }) {
  const back = front === "term" ? "definition" : "term";
  return `
    <div class="card-stage">
    <button type="button" class="flip-card ${flipped ? "flipped" : ""}" id="flip" aria-describedby="flip-live">
      <span class="flip-inner">
        <span class="face front" aria-hidden="${flipped}">
          <span class="face-label">${topLeft}</span>
          <span class="face-status">${topRight}</span>
          <span class="face-text">${esc(card[front])}</span>
          <span class="face-hint">Tap to flip</span>
        </span>
        <span class="face back" aria-hidden="${!flipped}">
          <span class="face-label">${LABEL[back]}</span>
          <span class="face-text">${esc(card[back])}</span>
          <span class="face-hint">Tap to flip back</span>
        </span>
      </span>
    </button>
    ${canSpeak() ? `<button type="button" class="speak-btn" id="speak" aria-label="Read the card aloud">${SPEAKER_ICON}</button>` : ""}
    </div>
    <p class="visually-hidden" id="flip-live" aria-live="polite">${flipped ? "Showing back" : "Showing front"}</p>
    ${card.hint ? `<div class="hint-box"><button class="text-btn" type="button" id="show-hint" aria-expanded="false" aria-controls="hint-text">💡 Show hint</button><p class="hint-text" id="hint-text" hidden>${esc(card.hint)}</p></div>` : ""}
    <div class="mark-row">
      <button class="btn btn-learn" type="button" data-mark="learning"><kbd>←</kbd> Still learning</button>
      <button class="btn btn-know" type="button" data-mark="known">I know it <kbd>→</kbd></button>
    </div>
    <p class="kbd-hint">Space to flip · ← still learning · → I know it</p>
    <p class="swipe-hint">Tap to flip · swipe right if you know it, left if you're still learning</p>`;
}

export function setFlipped(root, flipped) {
  const btn = root.querySelector("#flip");
  if (!btn) return;
  btn.classList.toggle("flipped", flipped);
  btn.querySelector(".front").setAttribute("aria-hidden", flipped);
  btn.querySelector(".back").setAttribute("aria-hidden", !flipped);
  root.querySelector("#flip-live").textContent = flipped ? "Showing back" : "Showing front";
}

// Swipe the card right (know it) or left (still learning). A drag suppresses
// the click that would otherwise flip the card.
export function attachSwipe(el, { onLeft, onRight, threshold = 90 }) {
  let startX = null;
  let startY = 0;
  let dx = 0;
  let dragging = false;
  let suppressClick = false;

  const reset = () => {
    el.style.transform = "";
    el.style.transition = "";
    el.classList.remove("swipe-left", "swipe-right");
  };
  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    suppressClick = false;
    reset();
    startX = e.clientX;
    startY = e.clientY;
    dx = 0;
    dragging = false;
  });
  el.addEventListener("pointermove", (e) => {
    if (startX === null) return;
    if (e.buttons === 0) {
      // Released outside the card: stop following the pointer.
      startX = null;
      dragging = false;
      reset();
      return;
    }
    dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!dragging && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
      dragging = true;
      el.setPointerCapture?.(e.pointerId);
    }
    if (!dragging) return;
    el.style.transition = "none";
    const tilt = matchMedia("(prefers-reduced-motion: reduce)").matches ? "" : ` rotate(${dx / 30}deg)`;
    el.style.transform = `translateX(${dx}px)${tilt}`;
    el.classList.toggle("swipe-right", dx > threshold);
    el.classList.toggle("swipe-left", dx < -threshold);
  });
  const end = () => {
    if (startX === null) return;
    const wasDragging = dragging;
    startX = null;
    dragging = false;
    if (!wasDragging) return;
    // Swallow the click this drag may produce, but never a later tap.
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);
    if (dx > threshold) onRight();
    else if (dx < -threshold) onLeft();
    else reset();
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", () => {
    startX = null;
    dragging = false;
    reset();
  });
  el.addEventListener(
    "click",
    (e) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.stopImmediatePropagation();
      e.preventDefault();
    },
    true,
  );
}

// The speaker button reads whichever side is showing, in that side's language.
export function bindSpeak(root, { deck, card, front, isFlipped }) {
  root.querySelector("#speak")?.addEventListener("click", () => {
    const side = isFlipped() ? (front === "term" ? "definition" : "term") : front;
    speak(card[side], langFor(deck, side, card[side]));
  });
}

export function bindHint(root) {
  const button = root.querySelector("#show-hint");
  button?.addEventListener("click", () => {
    const text = root.querySelector("#hint-text");
    text.hidden = !text.hidden;
    button.setAttribute("aria-expanded", !text.hidden);
    button.textContent = text.hidden ? "💡 Show hint" : "💡 Hide hint";
  });
}
