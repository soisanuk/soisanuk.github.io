# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

There is no build step, no lint, and no npm install — the web app is plain HTML/CSS/JS served as-is.

```sh
# Run all tests (Node 18+)
node --test

# Run a single test file
node --test tests/js/srs.test.js

# Run the app locally
cd web && python3 -m http.server 8000
# or just open web/index.html — works from file://, no network requests
```

Deploy is automatic: any push to `main` triggers `.github/workflows/pages.yml`, which publishes `web/` to the `gh-pages` branch via peaceiris/actions-gh-pages (live at https://mari0d.github.io/thaicab/). `.gitlab-ci.yml` does the same for GitLab Pages.

## Architecture

Single-page Thai vocabulary/script trainer PWA with SM-2 spaced repetition.

- `web/index.html` — HTML + CSS shell only: all screens and styles. App logic lives in `web/js/`.
- All `web/js/` files are **classic script tags sharing globals**, not ES modules — this keeps the app working from `file://` (module scripts don't load there). Do not add `import`/`export` to them. Load order in index.html matters for top-level constants; `mobile.js` must stay first (it defines `IS_MOBILE`/`IS_IOS`, used by `tts.js` and `game.js`) and `main.js` (keyboard shortcuts + init) must stay last. The root `package.json` `"type": "module"` exists only so `node --test` treats the test files as ESM.
- `web/js/mobile.js` — touch detection via `pointer: coarse` (deliberately not `ontouchstart`, so touch-screen laptops stay "desktop") and iOS detection (including iPadOS posing as MacIntel). Tags `<body>` with `.mobile`/`.ios`. CSS convention: wrap keyboard-shortcut UI in `class="kb-hint"` (hidden on mobile) and touch instructions in `class="touch-hint"` (shown only on mobile).
- `web/js/tts.js` — speech has three paths, tried in order: Capacitor native TTS plugin (`window.Capacitor.Plugins.TextToSpeech`) → Web Speech API. `_tts.speak` accepts a string or an **array of parts**; parts are spoken as separate utterances with a ~400 ms pause (Thai voices read a comma inside one utterance straight through, flattening it into even syllables). Single letters must always be spoken via `letterSpeechParts(ch)` (in `thai-script.js`) which produces ["sound", "name"] (ก → ["ก", "กอไก่"] — the name spelled solid so the voice reads it as one word, covering all consonants, single-mark vowels, and compound vowel patterns); it passes non-letters through as a single part, so wrapping is safe. `letterSpeech(ch)` is the joined-string form for display/comparison, not for speaking. On iOS Web Speech, `speak()` must stay inside the user-gesture call stack, so the 50 ms post-`cancel()` delay (a Chrome workaround) is skipped there, and a silent utterance on first touch unlocks speech. **Never let speech gate a state transition** — update game/UI state first and speak last (a throwing TTS path once froze Connect สี่ mid-turn).
- `web/js/audio.js` — chiptune SFX + background music for the games, synthesised live with the Web Audio API (no audio assets, works from `file://`). `_audio.sfx(name)` for one-shot effects, `_audio.music(track)`/`_audio.stop()` for the step-sequencer loops; `_audioScreen(id)` (called by `showScreen` in app.js) maps game screens to tracks, so entering a game starts its loop and navigating anywhere else stops it. The AudioContext is created lazily on first use — always inside a user gesture, satisfying autoplay policies. Mute (`_audio.toggleMute()`, persisted under `"thaicab_muted"`) is exposed via `.audio-mute-btn` buttons in the game footers; `main.js` syncs their glyphs at init.
- Vowel symbols must be **displayed** via `vowelDisp(sym)` (in `thai-script.js`), which swaps the data's ◌ placeholder for a ก host (◌ุ → กุ): U+25CC is missing from many system fonts and a ◌+combining cluster renders as tofu. The data keeps ◌ as its canonical form; only rendering changes.
- `web/js/game.js` / `tutor.js` / `soi-buakhao.js` / `connect4.js` / `baht-bus.js` — the games. Baht Bus teaches Thai numbers: `_bbThaiNum` composes 1–999 including the irregulars (เอ็ด for a trailing 1 above 10, ยี่ for 20), and the fare/negotiation helpers are pure; its sunset scene reuses `_BUS_ROWS`/`_WALK_FRAMES` from game.js (safe cross-file because they're only referenced inside functions, after all scripts have loaded). Walking Street pops via `_gPopBubble`, shared by desktop keyboard (`_gKey`) and mobile (`_gKbdPress`/`_gKeyIdx` — on mobile the tutor's on-screen Kedmanee keyboard, built by the shared `_tBuildKbdInto` from tutor.js, replaces the reference strip; every tapped key is spoken, and bubbles carry no Latin hints). The tutor and Walking Street must agree on the Kedmanee mapping (`TUTOR_ALL` vs `GAME_LETTERS` — a test enforces this).
- `web/js/srs.js` — SM-2 engine plus session-queue helpers (`requeue` for same-session relearning of failed cards, `dueForecast` for the stats chart). Progress lives in localStorage under the key `"thaicab_progress"`. `dueCards`/`peekCard` are deliberately read-only: never insert records on a read path, only `getCard` on a review/write path (a past bug persisted empty records for every key merely displayed; `app.js` still prunes those on load).
- `web/js/data.js` — all Thai data (words, consonants, vowels, tones); edit it directly, it is the source of truth. (It was originally generated from a Python app that has since been removed from the repo.)
- `web/js/sessions.js` — all study modes. Rating flows go through `_buildRatingHandler`, which also handles the undo snapshot and lapsed-card requeue; new rating-based modes should use it rather than calling `reviewCard` directly.
- `web/sw.js` — cache-first service worker. The cache name is `"thaicab-dev"` in the repo and is rewritten to `thaicab-<commit sha>` by both CI pipelines at deploy time, so **never hardcode a version bump**; do add new assets to `PRECACHE`.

### Tests load the real sources via node:vm

`tests/js/*.test.js` read the corresponding `web/js/` file and evaluate it with `vm.runInThisContext` (same realm, so `deepEqual` works), then test the resulting globals. Testable logic belongs in files that are **DOM-free at load time** — DOM access inside functions is fine as long as the tests don't call those functions (`game.js`, `tutor.js`, `soi-buakhao.js`, `baht-bus.js` are vm-loaded this way for their data/pure helpers; `mobile.js` and `tts.js` touch the DOM at load and can't be). Test files must be named `*.test.js` or Node's runner won't discover them.

Gotcha: top-level `const`/`let` from vm-loaded scripts land in the global *lexical* scope, not on the `globalThis` object — reference them as bare identifiers in tests; destructuring `globalThis` only works for `function` declarations.

## Capacitor packaging

Capacitor is scaffolded: `capacitor.config.ts` (`webDir: "web"`, no build step) plus committed `android/` and `ios/` platform dirs. **After any change to `web/` that should reach the native apps, run `npx cap sync`** — it copies the web assets into both platforms and re-registers plugins.

- The app accesses plugins via `window.Capacitor.Plugins.{App,TextToSpeech}` **without JS imports** (classic scripts can't import); natively installed plugins auto-register on the bridge. If TTS is silent in a packaged build, a missing `npx cap sync` is the first thing to check. Native TTS is **required for Android audio** — the Android System WebView has no `speechSynthesis`.
- `main.js` handles the Android hardware back button via `window.Capacitor.Plugins.App` (`backButton` → synthetic Escape keydown; `exitApp()` only from the menu screen).
- `index.html` skips service-worker registration under Capacitor and applies all four safe-area insets; the viewport meta has `viewport-fit=cover`.
- All hooks are no-ops in a plain browser (they key off `window.Capacitor`). Nothing in `web/` needs editing for packaging, and the web deploy pipelines publish `web/` only and must keep working unchanged — don't move or rename anything inside `web/`.
- **Do not add a build step or convert anything to ES modules** for packaging reasons; the directory is used as-is.

`web/README.md` is the detailed reference (features, keyboard shortcuts, file structure).
