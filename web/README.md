# Thai Trainer — ภาษาไทย

Thai vocabulary and script trainer with spaced repetition.

**Live:** https://mari0d.github.io/thaicab/

## Features

**Vocabulary**
- Flashcards Thai→English and English→Thai
- Multiple-choice quiz
- SRS review (SM-2 spaced repetition)
- Sentence SRS — fill in a blanked target word in context (`S`)

**Script**
- Consonant and vowel flashcards with SRS
- Consonant and vowel/tone drills
- Per-character decomposition with hover tooltips (consonant class, vowel description, tone marks)

**Tone listening drill** (`T`)
Play a word via text-to-speech, identify which of the 5 Thai tones it uses.

**Vocab list** (`V`)
All 819 words in Thai alphabetical order with real-time search. Filter by category with progress rings showing % mature cards. Click any word for a detail card with audio, romanisation, example sentence, and character decomposition.

**Statistics** (`0`)
SRS summary, per-category mature/seen counts, and progress export/import.

**Audio**
All Thai text is speakable via the Web Speech API (requires a Thai TTS voice — available in Chrome/Edge on desktop and Android).

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

Inside drills/cards: `Space`/`Enter` to reveal, `1–5` to rate, `Escape` to exit.

## File structure

```
web/
  index.html          main app (HTML + CSS + JS, ~2600 lines)
  manifest.json       PWA manifest
  sw.js               service worker (offline caching)
  icons/              PWA home screen icons
  js/
    data.js           all Thai data — words, consonants, vowels, tones
    srs.js            SM-2 spaced repetition engine
    examples.js       752 example sentences
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

Pushes to `main` deploy automatically to GitHub Pages via `.github/workflows/pages.yml`.
