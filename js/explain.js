// "✦ Explain this card": Claude explains the idea behind a card in plain
// language, with an example and a memory trick. Answers are cached on this
// device (state.explanations) so asking again is instant and works offline.

import { state, persist } from "./store.js";
import { esc, hash } from "./util.js";
import { announce } from "./ui.js";
import { explainCard, MODEL_LABEL } from "./ai.js";

const keyFor = (card) => hash(`${card.term}\u0000${card.definition}`);

export const explainButtonHTML = () =>
  `<div class="explain"><button class="text-btn explain-btn" type="button" id="explain" aria-expanded="false" aria-controls="explain-box"><span class="spark" aria-hidden="true">✦</span> Explain this card</button><div class="explain-box" id="explain-box" hidden></div></div>`;

const render = (x) => `
  <p>${esc(x.explanation)}</p>
  ${x.example ? `<p><strong>Example:</strong> ${esc(x.example)}</p>` : ""}
  ${x.memoryTrick ? `<p><strong>Memory trick:</strong> ${esc(x.memoryTrick)}</p>` : ""}
  ${x.cardIssue ? `<p class="explain-issue"><strong>About this card:</strong> ${esc(x.cardIssue)}</p>` : ""}
  <p class="hint">AI explanation from ${MODEL_LABEL}. Double-check with your notes or teacher.</p>`;

export function bindExplain(root, { deck, card }) {
  const button = root.querySelector("#explain");
  const box = root.querySelector("#explain-box");
  if (!button || !box) return;
  button.addEventListener("click", async () => {
    if (!box.hidden) {
      box.hidden = true;
      button.setAttribute("aria-expanded", "false");
      return;
    }
    box.hidden = false;
    button.setAttribute("aria-expanded", "true");
    const key = keyFor(card);
    const cached = state.explanations[key];
    if (cached) {
      box.innerHTML = render(cached);
      announce(cached.explanation);
      return;
    }
    box.innerHTML = `<p class="hint">Asking ${MODEL_LABEL}…</p>`;
    button.disabled = true;
    try {
      const x = await explainCard({ term: card.term, definition: card.definition, subject: deck.subject });
      state.explanations[key] = x;
      persist();
      if (!box.isConnected) return;
      box.innerHTML = render(x);
      announce(x.explanation);
    } catch (err) {
      if (!box.isConnected) return;
      box.innerHTML = `<p class="form-error">Couldn't get an explanation: ${esc(err.message)}.</p>`;
    } finally {
      button.disabled = false;
    }
  });
}
