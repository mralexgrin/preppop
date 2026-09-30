import { state, persist } from "../store.js";
import { plural } from "../util.js";
import { app, toast, setTitle } from "../ui.js";
import { MODEL_LABEL } from "../ai.js";

export function renderSettings() {
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
