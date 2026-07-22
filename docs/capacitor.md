# Capacitor packaging

Capacitor is scaffolded: `capacitor.config.ts` (`webDir: "web"`, no build step) plus committed `android/` and `ios/` platform dirs. **After any change to `web/` that should reach the native apps, run `npx cap sync`** — it copies the web assets into both platforms and re-registers plugins.

- The app accesses plugins via `window.Capacitor.Plugins.{App,TextToSpeech}` **without JS imports** (classic scripts can't import); natively installed plugins auto-register on the bridge. If TTS is silent in a packaged build, a missing `npx cap sync` is the first thing to check. Native TTS is **required for Android audio** — the Android System WebView has no `speechSynthesis`.
- `main.js` handles the Android hardware back button via `window.Capacitor.Plugins.App` (`backButton` → synthetic Escape keydown; `exitApp()` only from the menu screen).
- `index.html` skips service-worker registration under Capacitor and applies all four safe-area insets; the viewport meta has `viewport-fit=cover`.
- All hooks are no-ops in a plain browser (they key off `window.Capacitor`). Nothing in `web/` needs editing for packaging, and the web deploy pipelines publish `web/` only and must keep working unchanged — don't move or rename anything inside `web/`.
- **Do not add a build step or convert anything to ES modules** for packaging reasons; the directory is used as-is.

`web/README.md` is the detailed reference (features, keyboard shortcuts, file structure).
