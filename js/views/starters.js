// Starter deck gallery: add a ready-made deck for her classes in one tap.

import { state, persist, blankCard } from "../store.js";
import { esc, plural, uid } from "../util.js";
import { app, toast, setTitle } from "../ui.js";
import { SUBJECTS } from "../subjects.js";
import { STARTERS } from "../starters.js";

export function renderStarters() {
  setTitle("Starter decks");
  const added = (starter) => state.decks.find((d) => d.starter === starter.id);

  app.innerHTML = `
    <header class="page-head">
      <div>
        <a class="back" href="#/">← Decks</a>
        <h1>Starter decks</h1>
        <p class="lede">Ready-made decks for common classes. Add one, then edit it to match what your teacher covers.</p>
      </div>
    </header>
    ${SUBJECTS.map((subject) => {
      const starters = STARTERS.filter((s) => s.subject === subject.id);
      if (!starters.length) return "";
      return `
        <section class="subject-group" data-subject="${subject.id}" aria-labelledby="starter-${subject.id}">
          <h2 class="group-head" id="starter-${subject.id}"><span class="subject-dot" aria-hidden="true"></span>${subject.name}</h2>
          <ul class="deck-grid">${starters
            .map((s) => {
              const mine = added(s);
              return `
            <li class="deck-tile starter-tile" data-subject="${s.subject}">
              <div>
                <h3>${esc(s.name)}</h3>
                <p class="meta">${plural(s.cards.length, "card")} · ${esc(s.note)}</p>
              </div>
              <ul class="starter-preview">${s.cards
                .slice(0, 3)
                .map((c) => `<li><strong>${esc(c.term)}</strong> ${esc(c.definition)}</li>`)
                .join("")}</ul>
              <div class="deck-actions">
                ${
                  mine
                    ? `<a class="btn btn-soft" href="#/deck/${mine.id}/study">Added · Study it</a>`
                    : `<button class="btn btn-primary" type="button" data-add="${s.id}">Add deck</button>`
                }
              </div>
            </li>`;
            })
            .join("")}</ul>
        </section>`;
    }).join("")}`;

  app.querySelectorAll("[data-add]").forEach((b) =>
    b.addEventListener("click", () => {
      const starter = STARTERS.find((s) => s.id === b.dataset.add);
      if (!starter || added(starter)) return;
      state.decks.push({
        id: uid(),
        name: starter.name,
        subject: starter.subject,
        ordered: starter.ordered,
        starter: starter.id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        cards: starter.cards.map((c) => ({ ...blankCard(), ...c })),
      });
      persist();
      toast(`Added "${starter.name}"`);
      renderStarters();
    }),
  );
}
