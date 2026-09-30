# PrepPop

Make your own flashcards, study them, and test yourself.

**Live:** https://mralexgrin.github.io/preppop/

## Features

- **Deck maker.** Create a deck, type a term and a definition for each card, and save. Tab out of the last definition to start a new card, or tap **Paste a list** to turn a vocab list (one card per line) into cards in one go.
- **Flashcards.** See the term (or the definition first), flip the card, then mark it **I know it** or **Still learning**. Shuffle, or study only the cards you don't know yet. Keyboard: `Space` flips, `←` still learning, `→` I know it. On a phone, swipe the card right or left.
- **Write mode.** See one side and type the other. Grading ignores case and punctuation, accepts alternatives ("a / b") and optional words ("(to) eat"), flags missing accents without failing them, and lets you overrule a grade. Spanish decks get accent buttons. The logic is in `js/answer.js`.
- **Test mode.** Choose 10, 20, or all questions, and mix multiple choice, written, and true or false. Show the term, the definition, or a mix. Claude writes 3 believable wrong answers per question (they also serve as the false statements). Every answer reschedules the card. Keyboard: `1`–`4` or `T`/`F` to answer, `Enter` for the next question.

- **Today and spaced review.** The deck list opens with a Today panel: cards due across every deck, a daily goal, and a streak. Every answer (in Flashcards, Review, or a Test) reschedules the card. Known cards come back after 1, 3, 7, 14, 30, 60, then 120 days; missed cards come back the same day. The schedule lives in `js/srs.js`.
- **Steps.** For decks marked "in order" (procedures, timelines): tap the steps into the right order, 8 at a time for long decks (`js/steps.js`).
- **Progress.** Streaks, a 12-week practice calendar, weekly accuracy, mastery by subject, what's coming up, and the most-missed cards (`js/progress.js`).
- **Starter decks.** Ready-made decks (medical terminology, vital signs, cell parts, Spanish greetings, U.S. government, literary terms, geometry formulas) in `js/starters.js`, added from `#/starters`.
- **Pictures.** Cards can have a picture on either side, stored in IndexedDB after shrinking to 1024px (`js/images.js`). Included in backups and shared decks (validated image data URLs), not in sync. Unused pictures are cleaned up on load.
- **Test dates.** A deck can have a test date: a countdown on the deck and on Today, a Cram button, and reviews pulled before the test (`grade()` in `js/srs.js`).
- **Subjects.** Decks are grouped by subject (Biology, Clinical skills, Spanish, History, English, Geometry, Other).

## AI answer choices

Test mode's wrong answers come from Claude Opus 5.5. Visitors don't need a key. The app calls a small Cloudflare Worker in [`worker/`](worker/), which keeps the Anthropic API key as a secret and calls Claude with the official Anthropic SDK. Answers are cached per card in the browser, so retaking a test doesn't call the service again.

The Worker does two fixed jobs: wrong answers (`/wrong-answers`) and cards from notes (`/cards-from-notes`). The prompt, model, and limits are fixed on the server, so it can't be used as a general Claude proxy:

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
