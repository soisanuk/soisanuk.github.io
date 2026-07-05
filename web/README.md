# Thai Trainer — ภาษาไทย

Thai vocabulary and script trainer with spaced repetition.

**Live:** https://mari0d.github.io/thaicab/

## Features

**Vocabulary**
- Flashcards Thai→English and English→Thai
- Multiple-choice quiz
- SRS review (SM-2 spaced repetition)
- Sentence SRS — fill in a blanked target word in context (`S`)
- Same-session relearning: cards rated Forgot/Hard come back a few cards later until you pass them
- Undo last rating (`U` or the ↩ Undo button) in flashcard and SRS sessions

**Script**
- Consonant and vowel flashcards with SRS
- Consonant and vowel/tone drills
- Per-character decomposition with hover tooltips (consonant class, vowel description, tone marks)

**Tone listening drill** (`T`)
Play a word via text-to-speech, identify which of the 5 Thai tones it uses.

**Walking Street game** (`G`)
Neon consonant-drop game set in Pattaya. Bubbles fall carrying Thai consonants; type the correct key (Kedmanee layout) to pop each one — on touch devices, the tutor's on-screen Kedmanee keyboard appears instead: tap the key of the falling consonant (playable keys glow in their bubble's neon colour, locked keys stay subdued), and every tapped key is pronounced aloud. You start with 10 consonants; each new night adds one more, up to 15. Every 5 pops a random consonant's key hint is scheduled for removal — the next time it falls it blinks as a warning, then the hint is gone permanently. All 10 hints disappear across a long game, leaving you reading consonants cold. The street below features animated 8-bit pedestrians, motorbikes, baht buses, and palm trees; bubbles that hit them bounce off harmlessly (knocking the unlucky sprite off screen).

**Soi Buakhao game** (`B`)
Dialogue-driven visual novel: a 3-night bar crawl where a hostess asks simple questions in Thai (with audio) and you pick the best of four responses. Answer ≥60% correctly each night for a happy ending; the 3-night record determines the grand finale. Thai text is tokenised — tap any known word for its detail card. In-game: `1–4` select an answer, `Enter`/`Space` advances.

**Soi 6: Connect สี่** (`C`)
Connect 4 against a bar hostess — three difficulty levels, three girls (sweet trainee Nong, sharp Pim, and the undefeated Mamasan, Madam Oy, who plays a real lookahead AI and takes the first move). Each turn is a listening quiz: the vowel is spoken (sound + name), and you pick the matching Thai script from four choices to aim your own drop — get it wrong and the bar drops your token in a random column. Replaying the audio twice reveals the romanisation as a hint; with no Thai TTS voice, the romanisation is shown instead of audio. Losses go on your lady-drink tab. In-game: `1–4` answer, `1–7` pick a column, 🔊 replay.

**Thai Keyboard tutor** (`K`)
Learn the Kedmanee typing layout. A Thai character is shown (and spoken); type it on your keyboard — or tap the on-screen key on touch devices. Consonants-only or all-keys mode, with streak and accuracy tracking.

**Vocab list** (`V`)
All 876 words in Thai alphabetical order with real-time search. Filter by category with progress rings showing % mature cards. Click any word for a detail card with audio, romanisation, example sentence, and character decomposition. Clicking the Thai text on a flashcard opens the same detail view.

**Statistics** (`0`)
SRS summary, 7-day review forecast chart, per-category mature/seen counts, and progress export/import.

**Audio**
Individual letters are always spoken as sound + traditional name with a slight pause — e.g. ก is read "ก, ก ไก่", า as "อา, สระอา" — consistently across the keyboard tutor, Walking Street, script flashcards, drills, and script SRS. All Thai text is speakable via the Web Speech API (requires a Thai TTS voice — available in Chrome/Edge on desktop and Android, and in iOS Safari). On iOS, speech is unlocked by the first touch, as required by the platform. If no Thai voice is found, the home screen shows a notice instead of failing silently. When packaged as a native app with Capacitor, speech routes through the native TTS plugin instead (Android's WebView has no Web Speech API).

**PWA / offline**
Add to home screen on mobile. Works fully offline after first load.

**Mobile / touch**
Touch devices (detected via `pointer: coarse`) get an adapted UI automatically: keyboard-shortcut badges and hints are hidden, tap targets are enlarged, the games take touch input (tap signs in Walking Street, tap on-screen keys in the tutor), and safe-area insets keep content clear of notches.

## Keyboard shortcuts

All shortcuts are active on the home screen.

| Key | Action |
|---|---|
| `1` | Flashcards Thai→English |
| `2` | Flashcards English→Thai |
| `3` | Quiz |
| `4` | SRS Review |
| `5` | Consonant Cards |
| `6` | Vowel Cards |
| `7` | Consonant Drill |
| `8` | Vowel & Tone Drill |
| `9` | Script SRS |
| `T` | Tone Listening Drill |
| `S` | Sentence SRS |
| `G` | Walking Street game |
| `B` | Soi Buakhao game |
| `C` | Soi 6: Connect สี่ game |
| `K` | Thai Keyboard tutor |
| `V` | Vocab List |
| `0` | Statistics |
| `?` | Tutorial |

Inside drills/cards: `Space`/`Enter` to reveal, `1–5` to rate, `U` to undo the last rating, `Escape` to exit.

## File structure

```
web/
  index.html          HTML + CSS shell (screens, styles)
  manifest.json       PWA manifest
  sw.js               service worker (offline caching; cache name stamped by CI)
  icons/              PWA home screen icons
  js/                 classic scripts sharing globals (no modules — keeps file:// working)
    mobile.js         touch/iOS detection — IS_MOBILE, IS_IOS, body.mobile class (loaded first)
    data.js           all Thai data — words, consonants, vowels, tones
    examples.js       848 example sentences
    srs.js            SM-2 spaced repetition engine + queue/forecast helpers
    tokeniser.js      greedy longest-match Thai sentence tokeniser
    thai-script.js    character classification and cluster decomposition
    app.js            app state, navigation, category picker, export/import
    tts.js            TTS: Capacitor plugin → Web Speech API; voice notice
    ui.js             vocab list, word modal, tooltips, examples, statistics
    sessions.js       flashcards, quiz, drills, SRS sessions, rating/undo
    tutor.js          Thai keyboard (Kedmanee) typing tutor
    soi-buakhao.js    Soi Buakhao dialogue game — data + game flow
    connect4.js       Soi 6 Connect สี่ — vowel-quiz Connect 4 vs hostess AI
    game.js           Walking Street consonant-drop game (canvas)
    main.js           keyboard shortcuts, Android back button, init (loaded last)
```

## Run locally

```sh
cd web
python3 -m http.server 8000
# open http://localhost:8000
```

Or open `index.html` directly — all data is local script tags, no network requests, works from `file://`.

## Progress storage

SRS progress is stored in `localStorage` under key `thaicab_progress`. It persists across sessions in the same browser. Export/import via **Statistics** to move progress between devices or make backups.

## Deployment

Pushes to `main` deploy automatically to GitHub Pages via `.github/workflows/pages.yml`. The workflow rewrites the service-worker cache name (`thaicab-dev` → `thaicab-<commit sha>`) so every deploy invalidates the previous offline cache — no manual version bump needed.
