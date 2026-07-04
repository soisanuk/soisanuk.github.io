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
- All `web/js/` files are **classic script tags sharing globals**, not ES modules — this keeps the app working from `file://` (module scripts don't load there). Do not add `import`/`export` to them. Load order in index.html matters for top-level constants; `main.js` (keyboard shortcuts + init) must stay last. The root `package.json` `"type": "module"` exists only so `node --test` treats the test files as ESM.
- `web/js/srs.js` — SM-2 engine plus session-queue helpers (`requeue` for same-session relearning of failed cards, `dueForecast` for the stats chart). Progress lives in localStorage under the key `"thaicab_progress"`. `dueCards`/`peekCard` are deliberately read-only: never insert records on a read path, only `getCard` on a review/write path (a past bug persisted empty records for every key merely displayed; `app.js` still prunes those on load).
- `web/js/data.js` — all Thai data (words, consonants, vowels, tones); edit it directly, it is the source of truth. (It was originally generated from a Python app that has since been removed from the repo.)
- `web/js/sessions.js` — all study modes. Rating flows go through `_buildRatingHandler`, which also handles the undo snapshot and lapsed-card requeue; new rating-based modes should use it rather than calling `reviewCard` directly.
- `web/sw.js` — cache-first service worker. The cache name is `"thaicab-dev"` in the repo and is rewritten to `thaicab-<commit sha>` by both CI pipelines at deploy time, so **never hardcode a version bump**; do add new assets to `PRECACHE`.

### Tests load the real sources via node:vm

`tests/js/*.test.js` read the corresponding `web/js/` file and evaluate it with `vm.runInThisContext` (same realm, so `deepEqual` works), then test the resulting globals. Testable pure logic belongs in DOM-free files (`srs.js`, `tokeniser.js`, `thai-script.js`); DOM-touching code can't be vm-loaded. Test files must be named `*.test.js` or Node's runner won't discover them.

`web/README.md` is the detailed reference (features, keyboard shortcuts, file structure).
