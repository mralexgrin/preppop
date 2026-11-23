# Roadmap

Ranked by (user impact x confidence) / effort. Update after every shipped item.

## Phase 0 audit findings
1. All logic lives in one 800-line `app.js` with no unit tests; every new feature raises the risk of regressions.
2. Adding cards one at a time is slow. Teachers hand out vocab lists; there's no way to paste them.
3. Decks have no subject, so Biology, Spanish, and clinical decks pile up in one list.
4. Nothing tells her what to study today. "Known" is permanent, so cards she knew last month never come back (no spaced repetition).
5. Only recognition practice (flip, multiple choice). No recall practice (typing the answer), which is what tests and clinical work need. Spanish needs accents.
6. Data lives in one browser only, with no backup. Clearing Safari data or losing the phone loses everything.
7. Not installable or offline. On a phone it's a browser tab.
8. On phones the deck tile buttons wrap awkwardly, and there are no swipe gestures in flashcards.
9. No pronunciation for Spanish or medical terms.
10. No progress history (streak, what she practiced, weak cards).
11. Clinical procedures and history timelines are ordered lists, which term/definition cards can't practice.
12. Tests always use every card. A 120-card deck means a 120-question test.
13. The first run shows only an empty state; no starter content for her subjects.

## In progress
- (none)

## Next up
Approved order from the 2026-11-23 proposal ("make it competitive and unique"): check she can *use* what she learned, not just recognize it.

(All five approved items are built; see Done. Next ideas are below.)

## Ideas (unranked)
- AI at the learner's reading level (pass the level to every Worker route; prompts for elementary and middle school), once the COPPA decision is made
- Imported pictures get fresh ids, so a file imported by one learner can't replace another learner's picture
- Host the fonts locally (no Google Fonts request carrying visitors' IP addresses)
- Clinical Shift: more scenarios once the pilot's prompts are reviewed (a Spanish-speaking patient would join her Spanish and clinical work)
- Sync pictures across devices (separate encrypted blobs per image; the current vault is capped at 300 KB)
- Crop or annotate a picture (e.g. hide one label on a diagram)
- QR code for the sync key (scan instead of typing 25 characters)
- Daily cap on new sync vaults per IP (the Cloudflare rate-limit binding only supports 10s/60s windows)
- Images on cards (anatomy diagrams, geometry figures) stored in IndexedDB
- Share a deck by link (file sharing done in #6)
- Light/dark toggle

## Done
- #25 Clinical Shift pilot (2026-11-23, branch feat/clinical-shift; prompts not yet live-tested; needs clinical review)
- #24 Test readiness forecast (2026-11-23, branch feat/readiness)
- #23 Teach It Back (2026-11-23, branch feat/teach-back; prompt not yet live-tested)
- #22 Word Builder (2026-11-23, branch feat/word-builder, PR #3)
- #21 Mix-up detector + confidence check (2026-11-23, branch feat/mixups-confidence, PR #2)
- (Phase 0 docs)
- #1 Module split + test harness (2026-09-30, 70c13e8)
- #2 Paste-a-list import (2026-09-30, 61e9f43)
- #3 Subjects + library grouping + tile layout (2026-09-30, 4873f90)
- #4 Spaced repetition, Today panel, review, streak, daily goal, swipe (2026-09-30, 9ad1839)
- #5 Write mode with lenient, accent-aware grading (2026-09-30, 40647f9)
- #5b Mode tabs on deck screens (2026-09-30, cd7ed9d)
- #6 Backup/restore, deck sharing, backup reminder, daily goal setting (2026-09-30, 98b6742)
- #7 Installable PWA + offline (2026-09-30, cd2a096)
- #8 Phone tab bar with due badge (2026-09-30, 0cf363b)
- #9 Test options: count, types (choice/written/true-false), remembered (2026-09-30, daac252)
- #10 Read aloud (Web Speech, per-subject language) (2026-09-30, 7c4042d)
- #12 Starter decks for all her subjects (2026-09-30, bcaa229)
- #11 Progress page + per-card miss stats (2026-09-30, c528e12)
- #13 Steps mode for ordered decks + card reordering (2026-09-30, 5e058ca)
- #15 Cards from notes via Worker /cards-from-notes (2026-09-30, 0eff230)
- #14 Sync across devices: sync key, end-to-end encrypted, D1 (2026-09-30, 6ff7a2c, security reviewed)
- Re-audit polish: WCAG AA contrast, hidden-panel bug, one-row toolbar and editor header (2026-09-30, fc0247f)
- Test dates: countdown, Today banner, cram, reviews capped before the test (2026-09-30, 8491b8c)
- #17 Hints / memory tricks on cards (2026-09-30, 7e766a5)
- #18 Help page + first-run tip (2026-09-30, 3626083)
- #19 Search across all cards (2026-09-30, de6533a)
- #20 Pictures on cards (IndexedDB; backups and shared decks) (2026-09-30, b0d1776)
- Code review + accessibility review fixes (2026-09-30, b0974fb, 701fae0)
- Match game (2026-09-30, c26843a)
- Undo last card + picture descriptions (2026-09-30, 929f599)
- Daily reminder (.ics) + share progress summary (2026-09-30, 2d3fbe7)
- Explain this card (AI) (2026-09-30)
