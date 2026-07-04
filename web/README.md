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

**Vocab list** (`V`)
All 819 words in Thai alphabetical order with real-time search. Filter by category with progress rings showing % mature cards. Click any word for a detail card with audio, romanisation, example sentence, and character decomposition.

**Statistics** (`0`)
SRS summary, 7-day review forecast chart, per-category mature/seen counts, and progress export/import.

**Audio**
All Thai text is speakable via the Web Speech API (requires a Thai TTS voice — available in Chrome/Edge on desktop and Android). If no Thai voice is found, the home screen shows a notice instead of failing silently.

**PWA / offline**
Add to home screen on mobile. Works fully offline after first load.

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
| `V` | Vocab List |
| `0` | Statistics |

Inside drills/cards: `Space`/`Enter` to reveal, `1–5` to rate, `U` to undo the last rating, `Escape` to exit.

## File structure

```
web/
  index.html          HTML + CSS shell (screens, styles)
  manifest.json       PWA manifest
  sw.js               service worker (offline caching; cache name stamped by CI)
  icons/              PWA home screen icons
  js/                 classic scripts sharing globals (no modules — keeps file:// working)
    data.js           all Thai data — words, consonants, vowels, tones
    examples.js       752 example sentences
    srs.js            SM-2 spaced repetition engine + queue/forecast helpers
    tokeniser.js      greedy longest-match Thai sentence tokeniser
    thai-script.js    character classification and cluster decomposition
    app.js            app state, navigation, category picker, export/import
    tts.js            Web Speech API wrapper + voice availability notice
    ui.js             vocab list, word modal, tooltips, examples, statistics
    sessions.js       flashcards, quiz, drills, SRS sessions, rating/undo
    main.js           keyboard shortcuts and init (loaded last)
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
