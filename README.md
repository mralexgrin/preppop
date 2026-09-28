# PrepPop

Make your own flashcards, study them, and test yourself.

**Live:** https://mralexgrin.github.io/preppop/

## Features

- **Deck maker.** Create a deck, type a term and a definition for each card, and save. Tab out of the last definition to start a new card.
- **Flashcards.** See the term (or the definition first), flip the card, then mark it **I know it** or **Still learning**. Shuffle, or study only the cards you don't know yet. Keyboard: `Space` flips, `←` still learning, `→` I know it.
- **Test mode.** Multiple choice. Each question shows a term (pick the definition), a definition (pick the term), or a mix. Claude writes 3 believable wrong answers per question. Missed cards go back into the Still learning pile. Keyboard: `1`–`4` to answer, `Enter` for the next question.

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

- `index.html`: page shell
- `styles.css`: design tokens (light and dark) and components
- `app.js`: hash router, storage, and the Library, Editor, Flashcards, Test, and Settings views
- `ai.js`: calls the answer service
- `worker/src/index.js`: the Cloudflare Worker (validation, rate limit, Claude request, response cleanup)
