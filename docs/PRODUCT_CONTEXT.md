# Product Context

## What this product is
PrepPop is a simple, phone-friendly study companion. A student makes (or imports) decks of term/definition cards, then studies them with flashcards, spaced review, typed answers, and multiple-choice tests where Claude writes believable wrong answers. It should feel quick to open on a phone between classes and never make studying feel like admin work.

## Who uses it
- Primary user: a high school student (sophomore track) studying Biology, History, basic Spanish, English, soon Geometry, plus clinical skills to work alongside doctors. She needs to memorize terminology and medical concepts, prepare for tests, and practice a little every day.
- Secondary users: a parent who set it up and may check progress; classmates she shares a deck with.

## Core flows (do not break)
1. Create a deck, add term/definition cards, save.
2. Flashcards: flip, mark "I know it" / "Still learning".
3. Test: multiple choice with AI-written wrong answers, falling back to answers from other cards.
4. Edit and delete decks and cards.
5. Data persists across visits (localStorage key `preppop:v1`).

## Constraints
- Keep it simple: few screens, plain language, big tap targets. Mobile first.
- The user is a minor: collect no personal data (no email, no name). Any account uses an anonymous sync key.
- Static site on GitHub Pages (served from `main`), no build step, vanilla ES modules. AI and cloud features go through the Cloudflare Worker in `worker/`.
- Don't break stored data: migrate old saved state forward, never drop it.
- Tech stack: HTML/CSS/vanilla JS modules; Worker uses `@anthropic-ai/sdk` + wrangler.
- Run: `node scripts/serve.mjs 4190` then open http://localhost:4190
- Test: `npm test` in the repo root (app logic, `node --test`) and in `worker/`.

## Baseline (Phase 0, 2026-09-30)
- Worker tests: 8/8 pass. App: no unit tests yet.
- Worker not deployed yet (waiting on the owner's Cloudflare login), so AI answers currently fall back to deck answers. `SERVICE_URL` in `ai.js` is a placeholder.
