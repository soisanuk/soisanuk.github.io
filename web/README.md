# Thai Trainer — Web App

Single-page app, no build step required.

## Files

```
web/
  index.html          main app (HTML + CSS + JS)
  js/
    data.js           all Thai data (words, consonants, vowels, tones)
    srs.js            SM-2 spaced repetition engine
  .gitlab-ci.yml      GitLab Pages deployment
```

## Run locally

```sh
cd web
python3 -m http.server 8000
# open http://localhost:8000
```

Or just open `index.html` directly in a browser — all data is loaded from local script tags with no fetch calls, so it works from `file://` too.

## Deploy to GitLab Pages

1. Create a GitLab repo
2. Push the contents of the `web/` folder to the repo root (or adjust paths in `.gitlab-ci.yml`)
3. GitLab CI runs automatically and publishes to `https://<username>.gitlab.io/<repo>`

## Progress storage

All SRS progress is stored in `localStorage` under the key `thaicab_progress`. It persists across sessions in the same browser. Use **Statistics → Reset Progress** to clear it.
