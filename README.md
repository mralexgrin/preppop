# PrepPop

Make your own flashcards, study them, and test yourself.

**Live:** https://mralexgrin.github.io/preppop/

## Features

A study companion for a high school student: Biology, clinical skills, Spanish, History, English, Geometry. Phone-first, works offline, no account needed.

**Study every day**
- **Today and spaced review.** The deck list opens with a Today panel: cards due across every deck, a daily goal, a streak, and the next test. Every answer reschedules the card: known cards come back after 1, 3, 7, 14, 30, 60, then 120 days, missed ones the same day (`js/srs.js`). **Undo last card** fixes a mis-swipe.
- **Test dates.** A countdown on the deck and on Today, a **Cram** button, and reviews pulled to the day before the test.
- **Progress.** Streaks, a 12-week practice calendar, weekly accuracy, mastery by subject, what's coming up, and the most-missed cards. **Share my progress** sends a summary (`js/progress.js`).
- **Daily reminder.** A repeating calendar event (`.ics`) with an alert, from Settings.

**Practice modes** (tabs on every deck)
- **Flashcards.** Flip, then mark **I know it** or **Still learning**. Swipe on a phone, arrow keys on a computer. Read aloud (Spanish in a Spanish voice), hints, and **✦ Explain this card**.
- **Write.** Type the answer. Fair grading: case and punctuation ignored, "a / b" alternatives, "(to) eat" optional words, missing accents flagged but counted, small typos marked "almost", and **I was right** to overrule (`js/answer.js`). Spanish accent keys.
- **Test.** 10, 20, or all questions; any mix of multiple choice, written, and true or false. Claude writes the wrong answers (`js/testbuilder.js`).
- **Steps.** For decks marked "in order" (procedures, timelines): tap the steps into order (`js/steps.js`).
- **Match.** A quick timed game. It doesn't touch the schedule.

**Making cards**
- **16 starter decks** for her subjects (`js/starters.js`): medical terminology, vital signs, body directions, handwashing and radial pulse steps, cell parts, DNA basics, Spanish greetings, verbs, and numbers, U.S. government, a U.S. timeline, literary terms, parts of speech, angles and triangles, and geometry formulas.
- **Paste a list** (including Quizlet exports; `js/import.js`) and **✦ Cards from notes** (AI).
- **Pictures** on either side of a card, shrunk on-device into IndexedDB (`js/images.js`). **Hints / memory tricks**, **subjects**, reordering, and **search** across all cards.

**Keeping her data**
- Saved in the browser. **Backup / restore** and **Share deck** as files (`js/backup.js`, validated on import).
- **Sync across devices** with no account (see below).
- **Installable** on a phone's home screen and **offline** (service worker).
- Accessibility: WCAG 2.2 AA contrast, screen reader announcements, keyboard support with a switch to turn off shortcuts, and `lang="es"` on Spanish text.

## AI answer choices

Test mode's wrong answers come from Claude Opus 5.5. Visitors don't need a key. The app calls a small Cloudflare Worker in [`worker/`](worker/), which keeps the Anthropic API key as a secret and calls Claude with the official Anthropic SDK. Answers are cached per card in the browser, so retaking a test doesn't call the service again.

The Worker does three fixed AI jobs: wrong answers (`/wrong-answers`), cards from notes (`/cards-from-notes`), and explaining a card (`/explain`). The prompt, model, and limits are fixed on the server, so it can't be used as a general Claude proxy:

- Only browser requests from `mralexgrin.github.io` are allowed (`ALLOWED_ORIGINS` in `worker/wrangler.jsonc`). For local testing, override it in `worker/.dev.vars`, e.g. `ALLOWED_ORIGINS=http://localhost:4190`.
- 10 requests per visitor IP per minute, with at most 30 cards per request and 600 characters per field.

Also set a monthly spend limit on the key in the Anthropic Console.

If the service can't be reached, wrong answers are drawn from the deck's other cards.

### Deploying the Worker

```bash
cd worker
npm install
npx wrangler login
npx wrangler d1 create preppop-sync          # copy the database_id into wrangler.jsonc
npx wrangler d1 migrations apply preppop-sync --remote
npx wrangler deploy
npx wrangler secret put ANTHROPIC_API_KEY
```

Then set `SERVICE_URL` in `js/ai.js` to the deployed `workers.dev` URL. `npm test` runs offline tests against a stubbed Anthropic API and an in-memory database. For local testing, `npx wrangler d1 migrations apply preppop-sync --local` and then `npx wrangler dev`.

## Sync across devices

Settings → **Sync across devices** keeps decks and progress the same on every device, with no account:

- **Turn on sync** makes a random 25-character sync key. It's the only credential, so there's no email, name, or password. Show it and copy it from Settings.
- On another device, **I already have a sync key** links it. Decks from both devices are kept, each card keeps its most recent progress, a deck's card list follows its most recently edited copy, and deletions carry over.
- The key never leaves the device. `js/sync.js` derives three things from it (HKDF-SHA256): a storage id, an auth secret the server checks on every read and write (it stores only a hash), and an AES-GCM key. Data is compressed and encrypted before upload, bound to its id and version. The Worker stores only ciphertext in D1 (`/vault/:id`, with version checks so devices can't overwrite each other).
- Downloaded data is cleaned like an imported backup before it's merged (`cleanSyncData` in `js/backup.js`).
- Limits: 300 KB of ciphertext per vault, 60 sync requests and 3 new vaults per IP per minute, 20,000 vaults in total. Vaults unused for 12 months are deleted by a nightly cron. Erasing leaves a marker, so other linked devices turn sync off instead of re-uploading.
- Sync runs on its own: on the deck list, Progress, and Settings screens, after changes, and when the app goes to the background. **Turn off** can also erase the cloud copy.

## Install and offline

PrepPop is a Progressive Web App: `manifest.webmanifest` plus `sw.js`, a service worker that caches the app shell and serves every same-origin GET stale-while-revalidate. It can be added to a phone's home screen and works offline. The service worker is skipped on localhost so edits show up right away; open `http://localhost:4190/?sw` to test it. When you add a JS file, add it to `SHELL` in `sw.js` (`tests/sw.test.mjs` fails until you do). Icons are drawn by `node scripts/make-icons.mjs`.

## Data

Everything is saved in the browser's `localStorage`. There's no backend and no account. Settings has **Download backup** and **Restore or import a file** (full backups, or single decks shared with **Share deck** in the editor). Imported files are validated and cleaned in `js/backup.js`.

## Run locally

No build step. Serve the folder with any static server:

```bash
node scripts/serve.mjs 4190
```

Then open http://localhost:4190.

## Files

- `index.html`, `styles.css`: page shell, design tokens (light and dark), and components
- `js/app.js`: hash router
- `js/store.js`: saved state in localStorage and migration of older saved data
- `js/util.js`, `js/ui.js`: shared helpers
- `js/views/`: one module per screen (library, editor, study, test, settings)
- `js/ai.js`: calls the answer service
- `worker/src/index.js`: the Cloudflare Worker (validation, rate limit, Claude request, response cleanup)
- `docs/`: product context, roadmap, changelog, and the autonomous work log

## Tests

```bash
npm test            # app logic (node --test)
cd worker && npm test
```

`tests/browser-smoke.js` clicks through the core flows in the local preview. Its header comment has instructions.
