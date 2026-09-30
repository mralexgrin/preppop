# Changelog

User-facing release notes. Newest first.

## Unreleased (branch `autonomous/product-improvements`)
### Improved
- **Phone tab bar:** on phones, Decks, Review, New deck, and Settings sit in a bar at the bottom, in thumb reach. Review shows a badge with how many cards are due. The bar hides while you type. On larger screens, Review is in the top menu with the same badge.
- Every deck screen now has **Flashcards · Write · Test** tabs under the deck name, so switching modes is one tap.
- Deck tiles: Edit and Delete sit in the corner, and the Flashcards and Test buttons share the row evenly, so nothing wraps on a phone.
### Fixed
- The Review badge no longer shows "0" when nothing is due.
### Added
- **Steps practice for things that come in order:** in the deck editor, tick **Cards are in order** for a procedure (handwashing, taking a pulse) or a timeline. The deck gets a **Steps** tab. Tap the steps in the order you think is right (tap one again to take it back), then **Check my order** to see what's in the right place and the full correct order. Long decks are practiced 8 steps at a time. New starter decks: **Handwashing steps** and **U.S. history timeline**.
- **Reorder cards:** ↑ and ↓ buttons on each card in the editor.
- **Progress page** (the Progress tab): current and best streak, cards practiced this week and how many you got right, a 12-week practice calendar, what's due today, tomorrow, and this week, how many cards you know in each subject, and **Cards to work on** (the cards you've missed most). Every answer now counts how often a card was seen and missed. Backups include this; shared decks don't.
- **Starter decks:** ready-made decks for common classes, added in one tap from the empty screen or **Starter decks** on the deck list. Medical terminology (prefixes/suffixes), Vital signs (adult ranges), Cell parts, Spanish greetings, U.S. government basics, Literary terms, and Geometry formulas. Each becomes your own deck to edit.
- **Hear it:** the speaker button on a flashcard (and in Review) reads the side that's showing, using your device's built-in voices. Spanish decks read Spanish words in Spanish and English definitions in English. In Write mode, **Hear it** reads the right answer after you check.
- **Test options:** before a test, choose how many questions (10, 20, or all), which types (**Multiple choice**, **Written**, **True or false**, mixed evenly), and whether each question shows the term, the definition, or a mix. PrepPop remembers your choices. Written questions use the same fair grading as Write mode. True or false shows either the real answer or a believable wrong one. Every answer feeds your review schedule, and the results screen links to **Review missed cards**.
- **Install on your phone and study offline:** PrepPop can go on your home screen like an app (Settings → *Put PrepPop on your home screen* has the steps for iPhone and Android). It opens full screen, loads instantly, and works with no connection. Updates arrive the next time you open it. AI answers in Test mode still need internet.
- **Backup and restore:** Settings → **Download backup** saves all decks, progress, and settings to a file (on a phone it opens the share sheet so you can save to Files or iCloud Drive). **Restore or import a file** reads it back. Choose **Add decks I don't have** (keeps everything) or **Replace everything**. The deck list reminds you to back up once you have 20+ cards and haven't backed up in two weeks.
- **Share a deck:** in the deck editor, **Share deck** makes a file with just the cards (no progress) to send to a classmate. They open it from Settings → **Restore or import a file**.
- **Daily goal setting:** choose 10, 20, 30, or 50 cards a day in Settings.
- **Write mode:** see a definition and type the term (or the other way round), from the **Write** button on any deck. Grading is fair: capitals, punctuation, and extra spaces don't matter; "sofa / couch" accepts either; "(to) eat" accepts "eat"; a leading "to", "the", or "el" is optional. A missing accent still counts but shows the right spelling. Small typos get "Almost", and **I was right** lets you overrule the grade. Spanish decks get accent buttons (á é í ó ú ü ñ ¿ ¡). Rounds of 20, cards you don't know yet first, then **Practice missed again**.
- **Today panel and spaced review:** the top of the deck list shows how many cards are ready to review across all decks, a daily goal (20 cards), and your streak. Tap **Start review** to go through due cards in rounds of 20. Cards you know come back later (1, 3, 7, 14, 30, 60, then 120 days); cards you miss come back today, plus once more at the end of the round. Flashcards and Test answers count too. When nothing is due, the panel suggests a deck with new cards to learn.
- **Swipe on flashcards:** on a phone, swipe right if you know it, left if you're still learning. Tap still flips.
- Deck tiles show how many cards are due.
- **Subjects:** every deck belongs to a subject (Biology, Clinical skills, Spanish, History, English, Geometry, or Other), and the deck list is grouped by subject with a color for each. When you name a new deck, PrepPop guesses the subject ("Spanish verbs" picks Spanish); tap a subject to choose it yourself. Existing decks start in Other.
- The Solar System sample deck is replaced by starter decks for your actual subjects.
- **Paste a list:** in the deck editor, tap **Paste a list** and paste a vocab list, one card per line. PrepPop finds the separator on its own (tab, " - ", ":", "=", or ","), strips numbering like "1.", and shows how many cards it found before you add them. Quizlet exports paste in directly. Tick **Definition comes first** if your list is the other way round.
- Delete decks from the deck list, and delete a card while studying it.
- Answer service (Cloudflare Worker) so visitors don't need their own API key for AI answers. Needs deploying first; see `README.md`.
