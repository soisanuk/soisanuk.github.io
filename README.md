# thaicab

Thai vocabulary and script trainer with spaced repetition.

**Live app:** https://mari0d.github.io/thaicab/

## What's in this repo

| Path | Description |
|---|---|
| `web/` | Single-page web app (HTML + CSS + JS, no build step) |
| `thaicab/` | Python TUI backend (separate, legacy) |
| `tests/` | Python tests for the TUI backend |
| `tests/js/` | Node.js tests for the web app |

## Web app

See [`web/README.md`](web/README.md) for full feature list and local dev instructions.

## Running tests

**Python (TUI backend):**
```sh
pip install pytest
pytest tests/
```

**JavaScript (web app):**
```sh
node --test tests/js/
```
Requires Node 18+. No npm install needed.
