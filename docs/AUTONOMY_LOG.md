# Autonomy Log

Newest entries at the top. This file is the memory of the run: read it at the start of every session.

## Flagged for human review
- **Sync (roadmap #14) touches accounts and personal data of a minor. Please review before merging or deploying.** Design: no account; a random 125-bit sync key on the device derives the vault id, an auth secret (the server stores only its SHA-256), and an AES-GCM key. The server holds only ciphertext. Files: `js/sync.js`, `js/cloud.js`, `js/views/settings.js` (Sync section), `worker/src/index.js` (handleVault, cleanupVaults), `worker/migrations/0001_vaults.sql`. Deploying needs `wrangler d1 create preppop-sync`, the database_id in wrangler.jsonc, and `wrangler d1 migrations apply preppop-sync --remote`. Known limits: no daily cap on new vaults per IP (only 3/min) and no recovery if she loses the key (her local data stays). The privacy text says unused cloud copies are deleted after 12 months.
- **Production ALLOWED_ORIGINS is now only https://mralexgrin.github.io.** localhost moved to .dev.vars for local testing.
- **Starter deck content (js/starters.js), especially clinical.** The Handwashing steps deck (added in #13) follows a common nursing-assistant checklist order; programs differ slightly. The vital-sign values are standard adult references: HR 60–100, RR 12–20, BP <120/80 (AHA), SpO2 95–100%, fever ≥100.4 °F, stage 1 HTN 130–139/80–89 (AHA 2017). The deck says to follow the instructor, but her clinical program may teach slightly different ranges (e.g. temperature ranges vary by source). A quick human check is worthwhile.
- **Worker not deployed.** `npx wrangler login` didn't persist on this Mac, so the Worker is undeployed and `SERVICE_URL` in `ai.js` is a placeholder. Until it's deployed, Test mode uses answers from the deck's other cards. To finish: `cd worker && npx wrangler login && npx wrangler deploy && npx wrangler secret put ANTHROPIC_API_KEY`, then put the workers.dev URL in `ai.js`.
- **New AI prompt: /cards-from-notes (worker/src/index.js, NOTES_SYSTEM).** It tells the model to use only facts from the notes, to leave out unclear items, and to treat the notes as material, not instructions. Output is schema-constrained, trimmed, capped at 30 cards, and escaped when rendered. It's untested against the real model (no valid key here), so worth trying once the Worker is deployed.
- The branch includes `feat/ai-proxy-worker` (Worker + delete), which was never pushed or PR'd on its own.

## Current status
- Last completed: #19 search (de6533a)
- Next: #20 images on cards (IndexedDB), then re-audit
- Branch: autonomous/product-improvements
- Open PR: https://github.com/mralexgrin/preppop/pull/1 (not merged; merging publishes to Pages)

## Log
### 2026-09-30: Items 13-19 + reflection
- Shipped since the last reflection: #13 Steps (5e058ca), #15 cards from notes (0eff230), #14 sync (6ff7a2c), re-audit polish (fc0247f), test dates (8491b8c), #17 hints (7e766a5), #18 help page (3626083), #19 search (de6533a).
- Decisions:
  - Test dates cap a known card's next review at the day before the test, not an extra cram schedule. It's one rule inside grade() that every mode already uses.
  - Hints are revealed on demand and never flip the card, so self-testing stays honest.
  - Search results link to Flashcards for the deck (not the editor) because studying is the common intent.
- Re-audit notes: the deck list is getting long on phones (search bar, first-run tip, Today, backup reminder, groups). Watch for clutter. The intro tip disappears after "Got it", and the reminder only shows when relevant.

### 2026-09-30: Re-audit polish
- Light-mode contrast measured with a WCAG script. White on the orange buttons was 3.10:1 (fail). Buttons now use dark text (5.57:1), and small orange text uses a new --pop-ink token. know, learn, and ink-3 are darker in light mode, ink-3 lighter in dark mode. All text pairs are now ≥4.5:1.
- Bug found by screenshot: `.panel { display:flex }` overrode the `hidden` attribute, so the editor's Paste a list and Cards from notes panels were always visible (since #2). Fixed globally with `[hidden] { display:none !important }`. The smoke test now checks computed display, not just the attribute.
- Lesson: checking `el.hidden` isn't enough; check what's actually displayed.

### 2026-09-30: #14 Sync across devices (security reviewed twice)
- What: Settings → Sync across devices. Turn on (makes a sync key), connect another device with the key, sync now, show or copy the key, turn off (optionally erase the cloud copy). Sync runs on its own after changes, on the deck list, Progress, and Settings, and when the app is hidden.
- Why: the owner asked for "a basic account and database to store her practices". The design is account-free because the user is a minor.
- Merge rules: decks from both devices are kept; cards merge per card (union minus per-deck `deletedCards` markers); text follows the most recently edited deck copy; progress follows the most recent practice; deletions carry over via `deletedDecks`; activity keeps the busier count per day.
- Security review: 1 high, 3 medium, 3 low; every receipt was verified by grep, and all were fixed:
  - High: cloud data wasn't validated, allowing XSS via ids and stuck syncs. Fixed with cleanSyncData (backup cleaners + migrate) before merge.
  - Medium: storage abuse. Fixed with a 300 KB cap, CREATE_LIMITER, a 20k-vault cap, and nightly deletion after 12 months unused.
  - Medium: lost cards on concurrent edits. Fixed with a per-card union plus deletion markers.
  - Medium: restore undone by sync. Restored decks are marked fresh; Replace adds deletion markers.
  - Low: erase undone by another device. The server keeps an erased marker (410), and other devices turn sync off.
  - Low: the id alone gave write access. Fixed with a derived auth secret (server stores a hash) and AES-GCM additional data of id:version.
  - Low: a failed connect left data behind. Fixed with a full snapshot and rollback.
  - Also moved localhost out of the production origins.
- Found in my own end-to-end testing: connecting with a mistyped key created a new empty vault. It now reports that no data was found for that key.
- Verification: 93 app tests, 14 worker tests, 15/15 smoke flows. Real two-device runs (localhost vs 127.0.0.1, separate storage) against wrangler dev + local D1 covered: enable, connect, a wrong key, concurrent edits merging with no lost cards, deletion propagating, and erase turning sync off on the other device.

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
### Items 13-19
- Calls per tier: CMD ~120 (tests, node edit scripts, wrangler dev + local D1, git), FAST 0, STRONG main session, security-reviewer (inherit) x1 (sync), TOP 0
- Escalations: none
- Spot-check failures: 0 of 7 sync-review receipts wrong (all grep-verified)
- Routing changes: none. Sync crypto was kept on STRONG plus a security review (high-risk area), per the rules.
- Unexpectedly expensive: the two-device sync testing (two origins, a local D1, restarting the Worker for config changes). Worth it: it found the mistyped-key issue and the per-IP rate-limit issue that the unit tests missed.
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
