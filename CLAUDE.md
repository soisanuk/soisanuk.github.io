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
- `web/js/tts.js` — speech has three paths, tried in order: Capacitor native TTS plugin (`window.Capacitor.Plugins.TextToSpeech`) → Web Speech API. On iOS Web Speech, `speak()` must stay inside the user-gesture call stack, so the 50 ms post-`cancel()` delay (a Chrome workaround) is skipped there, and a silent utterance on first touch unlocks speech.
- `web/js/game.js` / `tutor.js` / `soi-buakhao.js` — the games. Walking Street pops via `_gPopBubble`, shared by keyboard (`_gKey`) and mobile tap (`_gTap`, bound only when `IS_MOBILE`). The tutor and Walking Street must agree on the Kedmanee mapping (`TUTOR_ALL` vs `GAME_LETTERS` — a test enforces this).
- `web/js/srs.js` — SM-2 engine plus session-queue helpers (`requeue` for same-session relearning of failed cards, `dueForecast` for the stats chart). Progress lives in localStorage under the key `"thaicab_progress"`. `dueCards`/`peekCard` are deliberately read-only: never insert records on a read path, only `getCard` on a review/write path (a past bug persisted empty records for every key merely displayed; `app.js` still prunes those on load).
- `web/js/data.js` — all Thai data (words, consonants, vowels, tones); edit it directly, it is the source of truth. (It was originally generated from a Python app that has since been removed from the repo.)
- `web/js/sessions.js` — all study modes. Rating flows go through `_buildRatingHandler`, which also handles the undo snapshot and lapsed-card requeue; new rating-based modes should use it rather than calling `reviewCard` directly.
- `web/sw.js` — cache-first service worker. The cache name is `"thaicab-dev"` in the repo and is rewritten to `thaicab-<commit sha>` by both CI pipelines at deploy time, so **never hardcode a version bump**; do add new assets to `PRECACHE`.

### Tests load the real sources via node:vm

`tests/js/*.test.js` read the corresponding `web/js/` file and evaluate it with `vm.runInThisContext` (same realm, so `deepEqual` works), then test the resulting globals. Testable logic belongs in files that are **DOM-free at load time** — DOM access inside functions is fine as long as the tests don't call those functions (`game.js`, `tutor.js`, `soi-buakhao.js` are vm-loaded this way for their data/pure helpers; `mobile.js` and `tts.js` touch the DOM at load and can't be). Test files must be named `*.test.js` or Node's runner won't discover them.

Gotcha: top-level `const`/`let` from vm-loaded scripts land in the global *lexical* scope, not on the `globalThis` object — reference them as bare identifiers in tests; destructuring `globalThis` only works for `function` declarations.

## Capacitor packaging (planned, not yet scaffolded)

The web app is already Capacitor-ready; all hooks are in place and are no-ops in a plain browser (they key off `window.Capacitor`):

- `tts.js` routes speech through `window.Capacitor.Plugins.TextToSpeech` when present. This is **required for Android audio** — the Android System WebView has no `speechSynthesis`.
- `main.js` handles the Android hardware back button via `window.Capacitor.Plugins.App` (`backButton` → synthetic Escape keydown; `exitApp()` only from the menu screen).
- `index.html` skips service-worker registration under Capacitor and already applies all four safe-area insets; the viewport meta has `viewport-fit=cover`.

When scaffolding, follow these constraints:

1. **Do not add a build step or convert anything to ES modules.** Set `webDir: "web"` in the Capacitor config and use the directory as-is — no copying, no bundler. The root `package.json` already exists (`"type": "module"` is for tests; it does not conflict).
2. Install `@capacitor/core`, `@capacitor/cli`, `@capacitor/app`, `@capacitor-community/text-to-speech`, and the platform packages (`@capacitor/android`, `@capacitor/ios`), then `npx cap add android|ios` and `npx cap sync`.
3. The app accesses plugins via `window.Capacitor.Plugins.{App,TextToSpeech}` **without JS imports** (classic scripts can't import). This works because natively installed plugins are auto-registered on the bridge — but only after the npm packages are installed *and* `npx cap sync` has run. If TTS is silent in a packaged build, a missing sync is the first thing to check.
4. gitignore `node_modules/`; whether `android/`/`ios/` platform dirs are committed is the user's call — ask.
5. The web deploy pipelines (`.github/workflows/pages.yml`, `.gitlab-ci.yml`) publish `web/` only and must keep working unchanged — don't move or rename anything inside `web/`.
6. Native icons/splash screens can be generated from `web/icons/` (e.g. `@capacitor/assets`).
7. Nothing in `web/` needs editing for packaging. If something seems to require it, re-read the hooks above first — the detection points already exist.

`web/README.md` is the detailed reference (features, keyboard shortcuts, file structure).
