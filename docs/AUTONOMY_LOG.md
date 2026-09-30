# Autonomy Log

Newest entries at the top. This file is the memory of the run: read it at the start of every session.

## Flagged for human review
- **Worker not deployed.** `npx wrangler login` didn't persist on this Mac, so the Worker is undeployed and `SERVICE_URL` in `ai.js` is a placeholder. Until it's deployed, Test mode uses answers from the deck's other cards. To finish: `cd worker && npx wrangler login && npx wrangler deploy && npx wrangler secret put ANTHROPIC_API_KEY`, then put the workers.dev URL in `ai.js`.
- The branch includes `feat/ai-proxy-worker` (Worker + delete), which was never pushed or PR'd on its own.

## Current status
- Last completed: Phase 0 (docs, baseline)
- Next: Roadmap #1, module split + test harness
- Branch: autonomous/product-improvements (based on feat/ai-proxy-worker)
- Open PR: none

## Log
### 2026-09-30: Phase 0
- What: Created docs (PRODUCT_CONTEXT, ROADMAP, CHANGELOG, this log), added `.autonomy/` to .gitignore, recorded the baseline.
- Why: Owner asked for an autonomous run to make PrepPop a full learning companion for a high school student (Biology, History, Spanish, English, Geometry, clinical skills). Simple and mobile-friendly, possibly with a basic account.
- Decision: The account will be an anonymous sync key (no email or name) because the user is a minor. Built last, after the local-first features, because it needs the Worker deployed and a human review.
- Verification: worker `npm test` 8/8.

## Model usage
(none yet)
