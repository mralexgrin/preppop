# Changelog

User-facing release notes. Newest first.

## Unreleased (branch `autonomous/product-improvements`)
### Improved
- Deck tiles: Edit and Delete sit in the corner, and the Flashcards and Test buttons share the row evenly, so nothing wraps on a phone.
### Added
- **Today panel and spaced review:** the top of the deck list shows how many cards are ready to review across all decks, a daily goal (20 cards), and your streak. Tap **Start review** to go through due cards in rounds of 20. Cards you know come back later (1, 3, 7, 14, 30, 60, then 120 days); cards you miss come back today, plus once more at the end of the round. Flashcards and Test answers count too. When nothing is due, the panel suggests a deck with new cards to learn.
- **Swipe on flashcards:** on a phone, swipe right if you know it, left if you're still learning. Tap still flips.
- Deck tiles show how many cards are due.
- **Subjects:** every deck belongs to a subject (Biology, Clinical skills, Spanish, History, English, Geometry, or Other), and the deck list is grouped by subject with a color for each. When you name a new deck, PrepPop guesses the subject ("Spanish verbs" picks Spanish); tap a subject to choose it yourself. Existing decks start in Other.
- **Paste a list:** in the deck editor, tap **Paste a list** and paste a vocab list, one card per line. PrepPop finds the separator on its own (tab, " - ", ":", "=", or ","), strips numbering like "1.", and shows how many cards it found before you add them. Quizlet exports paste in directly. Tick **Definition comes first** if your list is the other way round.
- Delete decks from the deck list, and delete a card while studying it.
- Answer service (Cloudflare Worker) so visitors don't need their own API key for AI answers. Needs deploying first; see `README.md`.
