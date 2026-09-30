// "How PrepPop works": plain-language help for every feature.

import { app, setTitle } from "../ui.js";

const SECTIONS = [
  {
    title: "The idea in one minute",
    body: `
      <p>You remember things best when you review them right before you'd forget. PrepPop does that timing for you.</p>
      <ol class="steps">
        <li>Study a deck in <strong>Flashcards</strong> and mark each card <strong>I know it</strong> or <strong>Still learning</strong>.</li>
        <li>Come back each day and tap <strong>Start review</strong> on the Decks screen. Cards you know come back after 1, 3, 7, 14, 30, 60, then 120 days. Cards you miss come back the same day.</li>
        <li>A few minutes a day beats cramming. Your streak and daily goal are on the Today panel.</li>
      </ol>`,
  },
  {
    title: "Making decks",
    body: `
      <ul class="help-list">
        <li><strong>Starter decks:</strong> ready-made decks for medical terms, vital signs, cell parts, Spanish, and more. Add one, then edit it to match your class.</li>
        <li><strong>Paste a list:</strong> in the deck editor, paste a vocab list (one card per line, like <em>hola - hello</em>) or a Quizlet export.</li>
        <li><strong>✦ Cards from notes:</strong> paste notes from class and AI suggests cards. Pick the ones you want, then check them over.</li>
        <li><strong>Hints:</strong> add a memory trick to any card. It stays hidden until you tap <em>Show hint</em>.</li>
        <li><strong>Cards in order:</strong> tick this for a procedure (like handwashing) or a timeline to get <strong>Steps</strong> practice.</li>
        <li><strong>Share deck:</strong> send a deck to a classmate. They open it from Settings.</li>
      </ul>`,
  },
  {
    title: "Ways to practice",
    body: `
      <ul class="help-list">
        <li><strong>Flashcards:</strong> tap to flip. On a phone, swipe right if you know it, left if you're still learning. The speaker button reads the card aloud.</li>
        <li><strong>Write:</strong> type the answer. Capitals and punctuation don't matter, a missing accent still counts (you'll see the right spelling), and if you were right but the app disagrees, tap <strong>I was right</strong>.</li>
        <li><strong>Test:</strong> choose how many questions and mix multiple choice, written, and true or false, like a real quiz.</li>
        <li><strong>Steps:</strong> tap the steps of a procedure or events of a timeline in the right order.</li>
      </ul>`,
  },
  {
    title: "Before a test",
    body: `
      <p>Open the deck, tap <strong>Edit</strong>, and set the <strong>Test date</strong>. You'll see a countdown, and until the test PrepPop brings cards back by the day before it. The Today panel gets a <strong>Cram</strong> button for the cards you don't know yet. Then take a practice <strong>Test</strong> the night before.</p>`,
  },
  {
    title: "Your progress",
    body: `<p>The <strong>Progress</strong> tab shows your streak, a calendar of the days you practiced, how many cards you know in each subject, and the cards you miss most.</p>`,
  },
  {
    title: "Keeping your cards safe",
    body: `
      <ul class="help-list">
        <li>Your decks are saved on this device. Nobody else can see them.</li>
        <li><strong>Sync across devices</strong> (Settings) keeps your phone and laptop in step using a sync key: no email or password. Everything is encrypted before it leaves your device.</li>
        <li><strong>Download backup</strong> (Settings) saves everything to a file you can keep in iCloud Drive or Google Drive.</li>
        <li>Put PrepPop on your home screen (Settings shows how) and it works without a connection.</li>
      </ul>`,
  },
];

export function renderHelp() {
  setTitle("How PrepPop works");
  app.innerHTML = `
    <header class="page-head">
      <div>
        <a class="back" href="#/">← Decks</a>
        <h1>How PrepPop works</h1>
      </div>
    </header>
    ${SECTIONS.map(
      (s, i) => `
      <section class="panel wide help-section" aria-labelledby="help-${i}">
        <h2 id="help-${i}">${s.title}</h2>
        ${s.body}
      </section>`,
    ).join("")}`;
}
