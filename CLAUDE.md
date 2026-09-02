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

# Re-copy the files The Last Baht Bus vendors from here (after editing any of
# data.js / examples.js / tokeniser.js / thai-script.js / wordcard.js / wordcard.test.js),
# and mirror web/ into the (gitignored) Capacitor android/ios native trees
node scripts/sync-vendored.mjs          # write the copies
node scripts/sync-vendored.mjs --check  # verify sync; exit 1 on drift

# Regenerate the two Paste Text data files. Both sources are downloads, not
# checked in — the script headers carry the URLs and licences. Only needed when
# the corpora change; the generated files ARE checked in.
node scripts/build-lexicon.mjs <words_th.txt> <tnc_freq.txt>          # → web/js/lexicon-th.js  (CC0)
node scripts/build-gloss.mjs <kaikki.org-dictionary-Thai.jsonl>       # → web/js/gloss-th.js    (CC BY-SA 3.0)

# Structural sweep of every screen, desktop + iPhone: JS errors, overflow,
# clipping, empty screens, and tap targets below the threshold for that input
# (touch vs pointer). Prints "ALL SCREENS CLEAN" when there is nothing to say.
node tools/sweep.mjs

# Browser-extension spike: can a content script tokenise Thai in someone else's
# page without breaking it? 24 checks over a hostile fixture. Not shipped code —
# see docs/chrome-extension-handoff.md §10 for what it settled.
node spike/run.mjs

# The extension's shadow-root shell: 9 checks that the card and the host page
# cannot reach each other's CSS, in either direction.
# NOT named *-test.mjs on purpose — `node --test` auto-discovers that pattern
# as well as *.test.js, so it ran this browser tool as a unit test and broke
# CI, which has no Playwright.
node spike/shell-check.mjs

# The browser extension is PACKAGED from the app, not authored separately:
# extension/vendor/*.js are copies of web/js sources and extension/shell.css is
# extracted from the card styles in web/index.html. Re-run after touching
# either, and --check fails on drift (CI runs it).
node scripts/build-extension.mjs           # write
node scripts/build-extension.mjs --check   # verify; exit 1 on drift

# Drive the real unpacked extension in Chrome: 10 checks that it looks words up
# on Alt, leaves the host page's markup and links alone, and can be dismissed.
node spike/ext-check.mjs
```

To load it: `chrome://extensions` → Developer mode → Load unpacked → select
`extension/`. Hold **Alt** and point at Thai text; Alt-click opens the card,
Escape closes it. Without Alt held the extension does nothing at all.

`tools/playtest-harness.mjs` drives the app for persona playtests — see
[docs/persona-playtests.md](docs/persona-playtests.md). Both tools borrow
Playwright from the sibling last-baht-bus checkout rather than declaring a
dependency here.

Deploy is automatic: any push to `main` triggers `.github/workflows/pages.yml`, which publishes `web/` to the `gh-pages` branch via peaceiris/actions-gh-pages (live at https://soisanuk.github.io/). `.gitlab-ci.yml` does the same for GitLab Pages.

## Architecture

Single-page Thai vocabulary/script trainer PWA with SM-2 spaced repetition. `web/index.html` is the HTML + CSS shell (all screens and styles); app logic lives in `web/js/`. **Per-file module catalog (what each `web/js/*.js` does): [docs/architecture.md](docs/architecture.md).** The load-bearing constraints and the test harness stay here:

- All `web/js/` files are **classic script tags sharing globals**, not ES modules — this keeps the app working from `file://` (module scripts don't load there). Do not add `import`/`export` to them. Load order in index.html matters for top-level constants; `mobile.js` must stay first (it defines `IS_MOBILE`/`IS_IOS`, used by `tts.js` and `game.js`) and `main.js` (keyboard shortcuts + init) must stay last. `segment.js` must load after `tokeniser.js` — it calls `_tkLegalBoundary`, the shared rule for where a token boundary may fall — and `paste.js` after `segment.js`, `gloss.js` and `curriculum.js`. Only `mobile.js` and `main.js` are order-critical at *parse* time; the rest are cross-file calls made inside functions, so they just need their dependency present before first use. The root `package.json` `"type": "module"` exists only so `node --test` treats the test files as ESM.
- Vowel symbols must be **displayed** via `vowelDisp(sym, host = "ก")` (in `thai-script.js`), which swaps the data's ◌ placeholder for a host consonant (◌ุ → กุ): U+25CC is missing from many system fonts and a ◌+combining cluster renders as tofu. Pass `"อ"` where the vowel should read as its pure sound (matches how it's voiced — the reference chart, vowel flashcards, Vowels & Tones drill, and Script SRS all do); the ก default remains elsewhere (course glyph cards, Connect สี่). The data keeps ◌ as its canonical form; only rendering changes. (Single letters must always be **spoken** via `letterSpeechParts(ch)` — see the catalog.)
- `web/sw.js` — cache-first service worker. The cache name is `"soisanuk-dev"` in the repo and is rewritten to `soisanuk-<commit sha>` by both CI pipelines at deploy time, so **never hardcode a version bump**; do add new assets to `PRECACHE`.
- **Vendored to The Last Baht Bus:** `data.js`, `examples.js`, `tokeniser.js`, `thai-script.js`, `wordcard.js` (+ `tests/js/wordcard.test.js`). THIS repo is the source of truth — edit here, never in LBB; after editing any of them run `node scripts/sync-vendored.mjs` (`--check` verifies, exit 1 on drift). The same script also mirrors all of `web/` into the gitignored Capacitor native trees (`android/.../public`, `ios/App/App/public`) — `npx cap copy` does the same job and is the canonical pre-build step; the script exists so `--check` catches drift too. Details in [docs/architecture.md](docs/architecture.md).

### Tests load the real sources via node:vm

`tests/js/*.test.js` read the corresponding `web/js/` file and evaluate it with `vm.runInThisContext` (same realm, so `deepEqual` works), then test the resulting globals. Testable logic belongs in files that are **DOM-free at load time** — DOM access inside functions is fine as long as the tests don't call those functions (`game.js`, `tutor.js`, `soi-buakhao.js`, `baht-bus.js`, `numbers.js`, and `wordcard.js` are vm-loaded this way for their data/pure helpers; `mobile.js` and `tts.js` touch the DOM at load and can't be). Test files must be named `*.test.js` or Node's runner won't discover them.

Gotcha: top-level `const`/`let` from vm-loaded scripts land in the global *lexical* scope, not on the `globalThis` object — reference them as bare identifiers in tests; destructuring `globalThis` only works for `function` declarations.

<!-- Capacitor packaging (native Android/iOS build & `npx cap sync`): docs/capacitor.md -->
<!-- Finding pedagogical/UX/translation-quality defects nothing else can catch — the persona-playtest method: docs/persona-playtests.md -->

## Post-Compaction Recovery

This project uses ContextR for context persistence. After a context reset or compaction:

1. Read `.contextr/state/checkpoint-latest.md` for the last-saved objective, in-flight work, and key files.
2. Read `.contextr/state/sticky.md` for persistent context that survives sessions.
3. Session-scoped items live in `.contextr/state/session.md` (git-ignored, may be absent).

## External Mutations Policy

Before any state-changing external call (API `PUT`/`POST`/`DELETE` to sensitive endpoints, config/settings/webhook changes), log the change to `.contextr/state/side-effects.md` with **what / why / how-to-reverse**, get explicit user confirmation, then update the log with the result. Never write raw credentials into tracked files — use `$ENV_VAR` or `$(op read …)` references.
