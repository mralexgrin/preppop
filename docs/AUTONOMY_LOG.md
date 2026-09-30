# Autonomy Log

Newest entries at the top. This file is the memory of the run: read it at the start of every session.

## Flagged for human review
- **Starter deck content (js/starters.js), especially clinical.** The Handwashing steps deck (added in #13) follows a common nursing-assistant checklist order; programs differ slightly. The vital-sign values are standard adult references: HR 60–100, RR 12–20, BP <120/80 (AHA), SpO2 95–100%, fever ≥100.4 °F, stage 1 HTN 130–139/80–89 (AHA 2017). The deck says to follow the instructor, but her clinical program may teach slightly different ranges (e.g. temperature ranges vary by source). A quick human check is worthwhile.
- **Worker not deployed.** `npx wrangler login` didn't persist on this Mac, so the Worker is undeployed and `SERVICE_URL` in `ai.js` is a placeholder. Until it's deployed, Test mode uses answers from the deck's other cards. To finish: `cd worker && npx wrangler login && npx wrangler deploy && npx wrangler secret put ANTHROPIC_API_KEY`, then put the workers.dev URL in `ai.js`.
- **New AI prompt: /cards-from-notes (worker/src/index.js, NOTES_SYSTEM).** It tells the model to use only facts from the notes, to leave out unclear items, and to treat the notes as material, not instructions. Output is schema-constrained, trimmed, capped at 30 cards, and escaped when rendered. It's untested against the real model (no valid key here), so worth trying once the Worker is deployed.
- The branch includes `feat/ai-proxy-worker` (Worker + delete), which was never pushed or PR'd on its own.

## Current status
- Last completed: #11 Progress page (c528e12)
- Next: #13 Steps mode, #16 card extras (hint, star, search), #15 AI cards from notes, #14 anonymous sync
- Branch: autonomous/product-improvements
- Open PR: https://github.com/mralexgrin/preppop/pull/1 (not merged; merging publishes to Pages)

## Log
### 2026-09-30: Items 10-12 + reflection
- Shipped: #10 read aloud (7c4042d), #12 starter decks (bcaa229, clinical content flagged), #11 Progress page + per-card stats (c528e12).
- Decisions:
  - Speech uses the browser's built-in voices: free, offline, no API. The language comes from the deck subject, and Spanish-looking text is always read in Spanish.
  - Starter decks replace the Solar System sample. The first run now leads to her real subjects.
  - Seen/missed stats live on each card (not in a separate log) so backups carry them and "Cards to work on" is cheap to compute.
- Re-audit: the flashcard toolbar is heavy on phones (two toggle rows plus Shuffle), there's no search across cards, and the Worker-backed features (#14, #15) can't be used for real until the owner deploys the Worker.
- Next order: #13 Steps mode (works fully offline, so it's useful on merge), #16 card extras, then #15 and #14 (built and tested locally with stubs, flagged).

### 2026-09-30: Items 6-9 + PR
- Shipped: #6 backup/restore/sharing (98b6742, security reviewed), #7 PWA + offline (cd2a096), #8 phone tab bar (0cf363b), #9 test options + zero-badge fix (daac252).
- Opened PR #1 to main. No CI on the repo; local gates are `npm test` (61) and the browser smoke test (11 flows).
- Test-harness lessons: navigating to the URL you're already on doesn't fire hashchange, and each re-render detaches old elements. Smoke steps now start from #/ and re-query after every change.

### 2026-09-30: #6 Backup, restore, deck sharing (security reviewed)
- What: Settings → Download backup / Restore or import a file (Add or Replace), Share deck in the editor (cards only, no progress), a backup reminder on the library, and a daily goal picker.
- Why: all data lives in one browser (audit #6). This is also the no-server answer to "share decks with classmates".
- Security: the security-reviewer agent found a **high** severity stored XSS. A crafted "backup" file could put HTML into deck or card ids, which are rendered unescaped in attributes. There was also a medium one via settings.lastSubject, plus two lows (unbounded sizes with silent save failure, duplicate ids). All four receipts were verified by grep. Fixed at the root in store.migrate(): every load and import now forces safe ids (`/^[A-Za-z0-9_-]{1,64}$/`, unique), string fields, valid statuses, a valid subject, a valid lastSubject, and a valid daily goal. Restore rolls back and says so if saving fails. Regression tests in tests/backup.test.mjs and tests/store.test.mjs. Checked end to end in the browser: a hostile file imported, and every screen visited, with no script run.
- Fixed along the way: uid()'s fallback made ids containing "." (`String(Date.now()+Math.random())`); it now matches the safe pattern.
- Verification: 53/53 unit tests, 10/10 smoke flows (new: backup round trip).

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
### Items 6-12
- Calls per tier: CMD ~90, FAST 0, STRONG main session, security-reviewer (inherit) x1, TOP 0
- Escalations: none
- Spot-check failures: 0 of 4 security receipts wrong (all verified by grep)
- Routing changes: starter-deck content kept on STRONG (accuracy-sensitive medical content), not FAST
- Unexpectedly expensive: the `$` mangling happened again in one smoke-test insertion. Smoke-test code is now inserted with the Edit tool only.
### Items 1-5
- Calls per tier: CMD ~60 (tests, greps, node edit scripts, git), FAST 0, STRONG main session, code-reviewer (inherit) x1, TOP 0
- Escalations: none
- Spot-check failures: 0 of 5 reviewer receipts wrong
- Routing changes: none. Refactors were done by a mechanical slicing script [CMD] instead of a FAST agent, which was cheaper and exact.
- Unexpectedly expensive: the browser smoke test hit three `$$`-in-replacement bugs from JS String.replace (`$$` becomes `$`). Now I use sed or literal edits when the text contains `$$`.
