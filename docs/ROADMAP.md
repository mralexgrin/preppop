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
| # | Item | Why (user problem) | Impact | Effort | Tier |
|---|------|--------------------|--------|--------|------|
| 4 | Spaced repetition + "Today" review across decks, streak | Finding 4 | H | M | [STRONG] |
| 5 | Write mode: type the answer, lenient + accent-aware matching, accent keys | Finding 5 | H | M | [STRONG] |
| 6 | Backup: export/import all data as a file | Finding 6 | H | S | [STRONG] |
| 7 | Installable PWA + offline | Finding 7 | H | S | [STRONG] |
| 8 | Mobile polish: bottom tab bar, swipe flashcards, tile layout | Finding 8 | M | S | [STRONG] |
| 9 | Test options: question count, question type mix (choice / written / true-false) | Finding 12 | M | S | [STRONG] |
| 10 | Pronunciation (speech) per deck language | Finding 9 | M | S | [STRONG] |
| 11 | Progress page: streak calendar, practice log, weakest cards | Finding 10 | M | M | [STRONG] |
| 12 | Starter decks for her subjects (med terminology, vital signs, Spanish basics, cell biology, geometry formulas) | Finding 13 | M | S | [STRONG] (content accuracy) |
| 13 | Steps mode: put ordered cards in order (procedures, timelines) | Finding 11 | M | M | [STRONG] |
| 14 | Anonymous account + cloud sync (sync key, Worker + D1) | Finding 6; cross-device | H | L | [STRONG] + security review, flag |
| 15 | AI: make cards from pasted notes (Worker endpoint) | Finding 2 | H | M | [STRONG] (AI prompt) |
| 16 | Card extras: hint/mnemonic, star, search | polish | M | S | [STRONG] |

## Ideas (unranked)
- Images on cards (anatomy diagrams, geometry figures) stored in IndexedDB
- Match game (timed pairs)
- Share a deck with a classmate via file or link
- Light/dark toggle
- AI "explain this" for a card

## Done
- (Phase 0 docs)
- #1 Module split + test harness (2026-09-30, 70c13e8)
- #2 Paste-a-list import (2026-09-30, 61e9f43)
- #3 Subjects + library grouping + tile layout (2026-09-30)
