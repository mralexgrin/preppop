# PrepPop

Make your own flashcards, study them, and test yourself.

**Live:** https://mralexgrin.github.io/preppop/

## Features

- **Deck maker.** Create a deck, type a term and a definition for each card, and save. Tab out of the last definition to start a new card.
- **Flashcards.** See the term (or the definition first), flip the card, then mark it **I know it** or **Still learning**. Shuffle, or study only the cards you don't know yet. Keyboard: `Space` flips, `←` still learning, `→` I know it.
- **Test mode.** Multiple choice. Each question shows a term (pick the definition), a definition (pick the term), or a mix. Claude writes 3 believable wrong answers per question. Missed cards go back into the Still learning pile. Keyboard: `1`–`4` to answer, `Enter` for the next question.

## AI answer choices

Test mode uses Claude Opus 5.5 through the official Anthropic SDK, called straight from the browser. Each person adds their own Anthropic API key in **Settings**. The key is kept in that browser's `localStorage` and only sent to `api.anthropic.com`. Generated answers are cached per card, so retaking a test doesn't call the API again.

Without a key, or if the API call fails, wrong answers are drawn from the deck's other cards (needs at least 4 cards).

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
- `ai.js`: Claude request, JSON schema, and response cleanup for wrong answers
