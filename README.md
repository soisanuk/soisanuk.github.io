# thaicab

Thai vocabulary and script trainer with spaced repetition.

**Live app:** https://mari0d.github.io/thaicab/

## What's in this repo

| Path | Description |
|---|---|
| `web/` | Single-page web app (HTML + CSS + JS, no build step) |
| `tests/js/` | Node.js tests for the web app |

## Web app

See [`web/README.md`](web/README.md) for full feature list and local dev instructions.

## Running tests

```sh
node --test
```
Requires Node 18+. No npm install needed. Tests load the real `web/js/` sources via `node:vm`.
