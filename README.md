# PrepPop

Make your own flashcards, study them, and test yourself.

**Live:** https://mralexgrin.github.io/preppop/

## Features

- **Deck maker.** Create a deck, type a term and a definition for each card, and save. Tab out of the last definition to start a new card, or tap **Paste a list** to turn a vocab list (one card per line) into cards in one go.
- **Flashcards.** See the term (or the definition first), flip the card, then mark it **I know it** or **Still learning**. Shuffle, or study only the cards you don't know yet. Keyboard: `Space` flips, `←` still learning, `→` I know it. On a phone, swipe the card right or left.
- **Write mode.** See one side and type the other. Grading ignores case and punctuation, accepts alternatives ("a / b") and optional words ("(to) eat"), flags missing accents without failing them, and lets you overrule a grade. Spanish decks get accent buttons. The logic is in `js/answer.js`.
- **Test mode.** Multiple choice. Each question shows a term (pick the definition), a definition (pick the term), or a mix. Claude writes 3 believable wrong answers per question. Missed cards go back into the Still learning pile. Keyboard: `1`–`4` to answer, `Enter` for the next question.

- **Today and spaced review.** The deck list opens with a Today panel: cards due across every deck, a daily goal, and a streak. Every answer (in Flashcards, Review, or a Test) reschedules the card. Known cards come back after 1, 3, 7, 14, 30, 60, then 120 days; missed cards come back the same day. The schedule lives in `js/srs.js`.
- **Subjects.** Decks are grouped by subject (Biology, Clinical skills, Spanish, History, English, Geometry, Other).

## AI answer choices

Test mode's wrong answers come from Claude Opus 5.5. Visitors don't need a key. The app calls a small Cloudflare Worker in [`worker/`](worker/), which keeps the Anthropic API key as a secret and calls Claude with the official Anthropic SDK. Answers are cached per card in the browser, so retaking a test doesn't call the service again.

The Worker only does this one job. The prompt, model, and limits are fixed on the server, so it can't be used as a general Claude proxy:

- Only browser requests from `mralexgrin.github.io` and `localhost:4190` are allowed (`ALLOWED_ORIGINS` in `worker/wrangler.jsonc`).
- 10 requests per visitor IP per minute, with at most 30 cards per request and 600 characters per field.

Also set a monthly spend limit on the key in the Anthropic Console.

If the service can't be reached, wrong answers are drawn from the deck's other cards.

### Deploying the Worker

```bash
cd worker
npm install
npx wrangler login
npx wrangler deploy
npx wrangler secret put ANTHROPIC_API_KEY
```

Then set `SERVICE_URL` in `ai.js` to the deployed `workers.dev` URL. `npm test` runs offline tests against a stubbed Anthropic API.

## Data

Everything is saved in the browser's `localStorage`. There's no backend and no account.

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
