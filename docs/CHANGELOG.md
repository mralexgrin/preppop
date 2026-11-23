# Changelog

User-facing release notes. Newest first.

## Unreleased (branch `feat/profiles`)
### Added
- **Learners and onboarding.** A first visit asks who's learning (a first name or nickname and an avatar), their grade (elementary, middle, or high school), and their subjects, then adds matching starter decks. Everyone on a shared device can have their own learner with their own decks and progress; tap your avatar at the top to switch or add one. No email or password.
- **New subjects and starter decks** for younger learners: Math, Science, and Social studies. New decks: times tables, shapes, planets, matter and the water cycle, parts of a plant, continents and oceans, kinds of words, Spanish colors, ratios and percents, pre-algebra, rocks and Earth's layers, ecosystems, the American Revolution, and figurative language.
### Improved
- Progress bars fill smoothly without shifting the page, and deck tiles lose the thick colored top edge.
### Fixed
- On phones, a long deck name in the Today panel's Learn button no longer pushes the page wider than the screen.

## Merged (branch `fix/sw-fresh-copies`)
### Fixed
- After an update, the app now picks up the new version on the next open instead of sometimes showing the old one for up to 10 minutes.

## Unreleased (branch `feat/clinical-shift`, pilot)
### Added
- **✦ Clinical Shift** (pilot): practice rooming a made-up patient, played by AI. Introduce yourself, check who they are, take vital signs, ask about symptoms, then report to the doctor and get feedback, including how you could chart the visit. Three patients to start. Find it under your Clinical decks.

## Unreleased (branch `feat/readiness`)
### Added
- **How ready am I?** With a test date set, Today and Progress → **Tests coming up** say about how ready you are and how many cards a day (and minutes) until the test should get you to about 90%. It's an estimate from your practice, and Help explains how it works.
### Improved
- Progress → How sure vs. how right only shows the "when sure" or "when guessing" half you've actually used.

## Unreleased (branch `feat/teach-back`)
### Added
- **✦ Explain it** (Teach It Back), in Write mode. See a term, explain it in your own words (type, or use your keyboard's mic), and get feedback: what you got right, what's missing, what's not quite right, and the card itself. Then answer one follow-up question if you want. Only "Got it" counts as known.

## Unreleased (branch `feat/word-builder`)
### Added
- **Word Builder.** A **Words** tab on the *Medical terminology* starter deck. Decode words you've never seen (what does *bradypnea* mean?) and build words from their meaning by tapping the parts in order. Every answer shows the parts, what each means, and the Spanish medical word. It also practices the deck's cards for those parts.
### Fixed
- Restoring a backup or syncing no longer forgets which starter decks you've added.
- On phones, a deck's mode tabs fit on screen, and the current tab is always visible.

## Unreleased (branch `feat/mixups-confidence`)
### Added
- **Confidence check in Test.** Pick an answer (or type one and tap Check), then tap **I'm sure** or **Guessing** (S / G). A lucky guess comes back tomorrow instead of counting as known. Results call out answers you were sure about but got wrong. Turn it off in the test setup.
- **How sure vs. how right** on Progress: per subject, how often you're right when you're sure or guessing, a warning when you're often sure and wrong, and a list of **blind spots**.
- **Mix-ups.** Giving one card's answer for another (tachycardia for bradycardia, ser for estar) is remembered as a pair. Feedback names the other card, the flip card says "You've mixed this up with…", Test includes the partner as one of the choices, and **Practice telling them apart** (from Progress or the Today panel) drills those pairs side by side until they're sorted out. The drill doesn't change your review schedule.

## 2026-10-01 (merged from `autonomous/product-improvements`)
### Improved
- Settings are ordered by how often you'll need them: Daily goal, Daily reminder, Sync, Backup, Install, Keyboard shortcuts, AI answers.
- **Accessibility:** screen readers now hear answer results in Write and Test, the new question after Next, the card's content when it flips, and the page name after moving between screens. Focus stays on the control you used when a screen redraws. Spanish text is marked as Spanish, so it's read with a Spanish voice. Right and wrong answers are marked with ✓/✗, not just color. Selected buttons and tabs show more than a color change. The practice calendar has a text version, and tap targets are at least 44px. **Settings → Keyboard shortcuts** turns off single-key shortcuts (arrows, 1–4, T/F) for screen reader or voice control users.
- Flashcards toolbar fits on one row on phones: the All / Not known yet filter plus icon buttons to swap sides and shuffle.
- Deck editor header fits on one row (Share, Save). **Delete this deck** moved to the bottom of the editor, away from Save.
- **Phone tab bar:** on phones, Decks, Review, New deck, and Settings sit in a bar at the bottom, in thumb reach. Review shows a badge with how many cards are due. The bar hides while you type. On larger screens, Review is in the top menu with the same badge.
- Every deck screen now has **Flashcards · Write · Test** tabs under the deck name, so switching modes is one tap.
- Deck tiles: Edit and Delete sit in the corner, and the Flashcards and Test buttons share the row evenly, so nothing wraps on a phone.
### Fixed
- The **Paste a list** and **Cards from notes** panels in the editor were always showing instead of opening when tapped.
- Text contrast in light mode now meets WCAG AA: dark text on orange buttons, darker orange for small text like "9 due", and darker greens, pinks, and gray labels.
- The Review badge no longer shows "0" when nothing is due.
### Added
- **More starter decks** (18 in all): Spanish present tense (-ar, -er, -ir), Photosynthesis and cellular respiration, Spanish common verbs, Spanish numbers 1–20, Body directions and positions, Taking a radial pulse (steps), DNA and genetics basics, Parts of speech, and Kinds of angles and triangles.
### Fixed
- Steps practice treats two identical steps as interchangeable, so swapping them isn't marked wrong.
- **✦ Explain this card:** under a flashcard in Flashcards or Review, and after a wrong answer in Write, tap **Explain this card** for a short plain-language explanation from Claude, with an example, a memory trick, and a gentle note if the card itself looks wrong. Explanations are saved on your device, so asking again is instant. Needs the answer service to be deployed.
- **Daily reminder:** Settings → **Daily reminder** → pick a time → **Add to my calendar** adds a daily "Study with PrepPop" event with an alert to your phone's calendar. No notifications permission or account needed.
- **Share my progress:** a button on the Progress page shares a short summary (streak, this week, cards known per subject, what's due) through Messages or anything else, or copies it.
- **Undo last card:** after marking a card in Flashcards or Review (including a mis-swipe), tap **↶ Undo last card** to go back to it. Its progress and today's count are restored exactly.
- **Describe a picture:** pictures on cards can have a short description, read by screen readers.
- **Match game:** a new **Match** tab on every deck. Tap a term, then its definition, until every pair is gone. A wrong pair adds a second, and your best time per deck is saved. It's a warm-up, so it doesn't change your review schedule or count toward the daily goal.
- **Pictures on cards:** in the deck editor, tap **+ Picture** on a card to add a diagram or a photo (on a phone you can use the camera). Choose **Term side** or **Definition side**. Pictures show in Flashcards, Review, Write, and Test, are shrunk on your device so they don't fill it up, and are kept in backups and shared decks. Sync doesn't carry pictures yet; on another device you'll see "Picture is on another device".
- **Search your cards:** a search box on the deck list finds cards across every deck by term, definition, or hint, ignoring capitals and accents ("nino" finds "niño"). Tap a result to study that deck.
- **How PrepPop works:** a help page (linked from Settings, the empty screen, and the first-run tip) that explains spaced review, making decks, each practice mode, what to do before a test, and keeping your cards safe. A short "How PrepPop works in 30 seconds" tip appears on the deck list until you tap **Got it**.
- **Hints and memory tricks:** in the deck editor, tap **+ Hint or memory trick** under a card to add one (e.g. "brady sounds like 'broody': slow"). While studying, **💡 Show hint** reveals it without flipping the card, in Flashcards, Review, and Write. Hints are kept in backups and shared decks.
- **Test dates:** in the deck editor, set an optional **Test date**. The deck shows a countdown ("Test in 3 days"), and Today shows a banner for the next test within two weeks with a **Cram** button that opens Flashcards on the cards you don't know yet. Until the test, cards you know come back by the day before it instead of weeks later.
- **Sync across devices (no account):** Settings → **Sync across devices** → **Turn on sync** gives you a sync key. Enter it on your other phone, laptop, or a school computer (**I already have a sync key**) and your decks and progress stay the same everywhere, and safe if you lose a device. There's no email, name, or password. Everything is encrypted on your device before it's uploaded, so PrepPop's server can't read it. Sync runs on its own after you study, and **Turn off** can also erase the cloud copy. Needs the PrepPop service to be deployed.
- **Cards from notes (AI):** in the deck editor, tap **✦ Cards from notes**, paste notes from class or a study guide, and tap **Suggest cards**. Claude picks the terms and concepts a teacher would test and writes short, plain-language definitions based only on your notes. Untick the ones you don't want and add the rest, then edit them before saving. Needs the answer service to be deployed and a connection.
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
