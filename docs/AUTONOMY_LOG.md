# Autonomy Log

Newest entries at the top. This file is the memory of the run: read it at the start of every session.

## Flagged for human review
- **Worker not deployed.** `npx wrangler login` didn't persist on this Mac, so the Worker is undeployed and `SERVICE_URL` in `ai.js` is a placeholder. Until it's deployed, Test mode uses answers from the deck's other cards. To finish: `cd worker && npx wrangler login && npx wrangler deploy && npx wrangler secret put ANTHROPIC_API_KEY`, then put the workers.dev URL in `ai.js`.
- The branch includes `feat/ai-proxy-worker` (Worker + delete), which was never pushed or PR'd on its own.

## Current status
- Last completed: #5 Write mode (40647f9)
- Next: deck mode tabs (quick win), then #6 Backup, #7 PWA
- Branch: autonomous/product-improvements (based on feat/ai-proxy-worker)
- Open PR: none

## Log
### 2026-09-30: Items 1-5 shipped, reflection
- Shipped: #1 module split + tests (70c13e8), #2 paste-a-list (61e9f43), #3 subjects (4873f90), #4 spaced repetition + Today + swipe (9ad1839), #5 Write mode (40647f9).
- Decisions:
  - Spaced repetition is a simple box schedule (1/3/7/14/30/60/120 days), not SM-2. It's easier to explain to a student and only needs the two existing buttons. A correct answer on a not-yet-due card doesn't promote it, so cramming can't inflate intervals.
  - Old cards get a schedule on load: "known" is due tomorrow, "still learning" is due today. The alternative of treating them as new would have hidden her history.
  - Write-mode grading is lenient, with an "I was right" override. The grade is saved only on Next, so the override can change it.
  - Swipe was pulled forward from #8 because Review is the phone-first screen.
- Review: the code-reviewer agent found 2 swipe bugs and 3 nits in #4 (receipts verified by grep). All fixed before the push.
- Correction: the 40647f9 commit message says "54/54 unit tests". The real count was 45/45; the answer tests were already included in the earlier count. Not amended because history is pushed.
- Re-audit: moving between modes relies on one "Switch to X" button per screen, so deck-level mode tabs go next. Settings is nearly empty (the daily goal and backup belong there). Test mode still asks every card (#9).

### 2026-09-30: Phase 0
- What: Created docs (PRODUCT_CONTEXT, ROADMAP, CHANGELOG, this log), added `.autonomy/` to .gitignore, recorded the baseline.
- Why: Owner asked for an autonomous run to make PrepPop a full learning companion for a high school student (Biology, History, Spanish, English, Geometry, clinical skills). Simple and mobile-friendly, possibly with a basic account.
- Decision: The account will be an anonymous sync key (no email or name) because the user is a minor. Built last, after the local-first features, because it needs the Worker deployed and a human review.
- Verification: worker `npm test` 8/8.

## Model usage
### Items 1-5
- Calls per tier: CMD ~60 (tests, greps, node edit scripts, git), FAST 0, STRONG main session, code-reviewer (inherit) x1, TOP 0
- Escalations: none
- Spot-check failures: 0 of 5 reviewer receipts wrong
- Routing changes: none. Refactors were done by a mechanical slicing script [CMD] instead of a FAST agent, which was cheaper and exact.
- Unexpectedly expensive: the browser smoke test hit three `$$`-in-replacement bugs from JS String.replace (`$$` becomes `$`). Now I use sed or literal edits when the text contains `$$`.
