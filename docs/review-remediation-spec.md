# Review Remediation Spec

Work order for fixes arising from the 2026-08 code review + project appraisal.
Self-contained: everything you need is in this file plus `CLAUDE.md` and
`docs/architecture.md` (read both before starting). Work through phases in
order; each numbered item is independently commitable.

## Ground rules (violating these is worse than not doing the work)

- **No ESM in `web/js/`** — classic scripts sharing globals. No `import`/`export`.
- **Load order matters** (see index.html): `mobile.js` first, `main.js` last.
  New cross-file references are fine *inside functions* (called after load),
  not at top level.
- **Vendored files** (`data.js`, `examples.js`, `tokeniser.js`,
  `thai-script.js`, `wordcard.js`, `tests/js/wordcard.test.js`): after editing
  any of them run `node scripts/sync-vendored.mjs`, and verify with `--check`.
  Never edit the copies in `~/projects/last-baht-bus`. **Do not commit or push
  anything in the last-baht-bus repo** — the operator handles that repo.
- **After any vendored-file change**, also run LBB's suite:
  `cd ~/projects/last-baht-bus && node --test` (the printed-Thai guard lives there).
- **`web/sw.js`**: never change the cache name; DO add any new asset to `PRECACHE`.
- Tests: `node --test` from repo root. New test files must end `.test.js`.
  Gotcha: vm-loaded top-level `const`/`let` land in lexical scope, not
  `globalThis` — reference them as bare identifiers in tests; destructure
  `globalThis` only for `function` declarations.
- **Commit per item (or per small item-group), full suite green each time.
  Do NOT push** — pushing `main` auto-deploys; the operator pushes.
- Tone vocabulary used throughout: `"mid" | "low" | "falling" | "high" | "rising"`.

Verification beyond unit tests (optional but encouraged for UI items): serve
`cd web && python3 -m http.server 8117`, drive headlessly with Playwright
borrowed from LBB — see `tools/sweep.mjs` for the `createRequire` pattern.
Dismiss the first-run overlay via
`document.getElementById("tutorial-overlay").style.display="none"`.

---

## P0 — small, real bugs

### P0.1 Service worker misses two loaded scripts
`web/sw.js` `PRECACHE` lacks `./js/wordcard.js` and `./js/idioms.js`, both
script-loaded by index.html — the word-card modal (core to every mode) breaks
on first offline load.
**Fix:** add both to `PRECACHE`.
**Accept:** every `js/*.js` in index.html appears in PRECACHE
(`grep -oE 'js/[a-z0-9-]+\.js' web/index.html | sort -u` vs same over sw.js).

### P0.2 Orphan example key `ความความฝัน`
`web/js/examples.js` has key `"ความความฝัน"` (doubled-syllable typo); the real
word `ความฝัน` (data.js) therefore has no example.
**Fix:** rename the key to `"ความฝัน"`. If the sentence itself contains the
doubled form, fix the sentence too — it must contain the literal headword.
**Accept:** `EXAMPLES["ความฝัน"][0].includes("ความฝัน")`; no `ความความฝัน`
anywhere. Re-vendor (examples.js is vendored) + run LBB tests.

### P0.3 CLAUDE.md drift (two spots)
1. The Architecture bullet still says vowels display "swaps the data's ◌
   placeholder for a ก host (◌ุ → กุ)". Reality: `vowelDisp(sym, host = "ก")`
   now takes a host; the reference chart, vowel flashcards, Vowels & Tones
   drill, and Script SRS pass `"อ"` (pure-vowel reading, matches the audio);
   ก remains the default elsewhere (course glyph cards, Connect สี่).
2. It says the SW cache name is `"thaicab-dev"`; it is `"soisanuk-dev"`.
**Fix:** correct both sentences (keep them terse — CLAUDE.md is
constraints-only; details belong in docs/architecture.md).
**Accept:** CLAUDE.md matches shipped code; no other stale host/cache mentions
(`grep -n "thaicab-dev\|ก host" CLAUDE.md docs/architecture.md`).

### P0.4 Tone Drill: distinguish tone names from mark names
`sessions.js` `toneDrillShow` renders choices as `TONES[i][0]` + `TONES[i][1]`
(สามัญ/เอก/โท/ตรี/จัตวา + mid/low/falling/high/rising). Since the answer key
now grades *realized* tones, a low-class word with mai tho (ม้า → realized
HIGH = เสียงตรี) shows "ตรี" while the written mark is ้ — learners who read
the mark answer โท and are marked wrong with no explanation. In Thai the tone
names and mark names share words; the fix is to disambiguate and teach the rule:
**Fix:**
1. Prefix the Thai choice labels with เสียง (เสียงสามัญ, เสียงเอก, …) so they
   unambiguously name tones, not marks.
2. In the answer reveal (both correct and wrong), append one rule line built
   from `syllableToneInfo(word[0])` (thai-script.js), e.g.
   `low class + ้ mai tho → HIGH tone`. Map: cls as-is; mark key→glyph
   (ek ่, tho ้, tri ๊, chattawa ๋, none —); tone via the shared labels (see P2.6).
3. Audit `data.js` `TONES` descriptions — row 2 says "เอก … falling tone — ่"
   but เอก is the LOW tone. Correct each description to its realized tone
   (mid/low/falling/high/rising) with its usual mark.
**Accept:** manual check of a ม้า-class reveal; `TONES` descriptions match
column 2; existing sessions tests still pass (update them if they assert
labels).

### P0.5 Completed units must stay re-openable; placement must not complete the tone unit
Two related bugs from inserting the tone unit at `COURSE[6]`:
- `learn.js` `_unitUnlocked(path, idx)` requires the *previous* unit done, and
  `startLearn` attaches `onclick` only when open — so a returning user who had
  completed g3 (now index 7) cannot re-open it until they do the new tone1.
- `_placementApply` marks every COURSE index `0..last` done, so anyone placing
  past letter batch 4 gets tone1 marked `{done, placed}` without ever seeing
  it — placement only tests letter recognition, not tones.
**Fix:**
1. `_unitUnlocked`: return true when `idx === 0`, OR previous unit done, OR
   **the unit itself is done** (a completed unit is always re-enterable).
2. `_placementApply`: skip units with `kind === "tone"` when marking done
   (keep marking letters + chunk units as today). Net effect: a placed learner
   resumes exactly at the tone unit — intended.
**Accept:** new tests in `tests/js/learn.test.js`:
- a path with `g1` done but its predecessor's successor not → `_unitUnlocked`
  true for the done unit itself;
- `_placementApply(path, cut≥4)` leaves `tone1` not done, marks surrounding
  letters/chunks done; the first not-done unit for such a path is `tone1`.

---

## P1 — engine & course quality

### P1.1 Parser branches for bare ◌ือ and ◌ว (45 words currently null)
`thai-script.js` `_analyseSyllable` has no branch for the open vowel ◌ือ
(no leading เ) or the reduced ◌ว "ua" before a final, so 45 common
monosyllables return null — uncolored in the reader, excluded from the tone
drill. Add, in the compound-vowel section (alongside the existing
`เ◌ือ` / `◌ัว` / `เ◌ีย` / `◌อ` branches):
1. `tail[0] === "อ" && trailing === "ื"` (bare ◌ือ): `long = true`, open or
   with one real final (`finalChar = tail[1] || null`; >2 tail → null).
2. `tail[0] === "ว" && trailing === "" && tail.length === 2` (reduced ◌ว
   before a final, e.g. สวย/ด้วย/ควร/ขวด): `long = true`,
   `finalChar = tail[1]`.
**Accept:** add to `tests/js/tone.test.js` (all verified against RTGS):
`มือ→mid, คือ→mid, ถือ→rising, ชื่อ→falling, ซื้อ→high, สวย→rising,
ด้วย→falling, ช่วย→falling, ควร→mid, ขวด→low, รวย→mid`. Existing 53 tone
tests must stay green (regression risk: ควาย/แล้ว/กว่า paths — covered by
existing tests; run the whole file). Re-vendor + LBB tests (thai-script.js is
vendored). Then re-measure the null count:
monosyllabic-by-rtgs words with `syllableTone === null` should drop from 45 to
mostly cluster-onset words (เกลียด, เปลี่ยน, กลัว…), which are correctly
conservative.

### P1.2 Route every arbitrary-text call through `toneOfWord`
`syllableTone` on unhyphenated polysyllables returns confidently wrong tones
(`syllableTone("อร่อย") === "low"`). Today the RTGS-hyphen guard in
`toneOfWord` (curriculum.js) is the only protection.
**Fix:**
1. Audit call sites: any caller passing text that is not *known monosyllabic*
   must use `toneOfWord`. Known offender: `learn.js` `_unitQueue` filters
   `TONE_READ_WORDS` with raw `syllableTone` — switch to `toneOfWord`.
   (reader.js already uses `toneOfWord`.)
2. Add a loud contract comment on `syllableTone`/`syllableToneInfo`: input is
   ONE syllable; for arbitrary words use `toneOfWord`.
3. In `_detectWordTone` (sessions.js), replace the silent `|| 0` fallback:
   if `TONES.findIndex` returns -1 for a non-null tone, `console.warn` and
   return 0 — drift between TONES[i][1] and the engine vocabulary must not be
   silent.
**Accept:** grep shows no raw `syllableTone(` call outside thai-script.js,
curriculum.js (`toneOfWord` internals), and tests; sessions test for the
fallback warning path.

### P1.3 Tone cards get real read-only recaps on revisit
`toneear`/`toneread` are graded quiz cards but sit in `_TEACH_KINDS`
(learn.js), so revisiting re-runs them live: `toneear` re-randomizes its
target each visit and accepts answers it discards — breaking the frontier's
"behind = completed, read-only" invariant that word cards honor.
**Fix:**
1. Choose each `toneear` target at queue-build time in `_unitQueue`
   (store e.g. `item.pick` = index into the minimal set); `_wToneEar` uses it
   instead of `Math.random` at render.
2. Extend `_wReviewCard` to recap tone kinds: `toneear` → the target syllable,
   its tone label, tap-to-hear; `toneread` → word + meaning + tone label.
3. Remove `toneear`/`toneread` from `_TEACH_KINDS` (`toneIntro`/`tonecalc`
   stay — they are genuine teach cards).
**Accept:** learn.test: `_unitQueue` tone unit's `toneear` items carry a
stable target; revisit rendering is deterministic (unit-test the queue shape;
UI recap via the Playwright harness if convenient).

### P1.4 Memoize reader grading
`startReader` grades the ~868-sentence corpus 4× for the level counts and a
5th time on open; `readerGrade` calls `taughtGlyphs(i)` per glyph per rung
(fresh Set each call).
**Fix (keep signatures; all pure):**
1. In curriculum.js or reader.js: lazy module-level `Map` glyph → earliest
   batch index (built once from LETTER_BATCHES); `readerGrade` = max of O(1)
   lookups (letters absent from the map count as `LETTER_BATCHES.length`).
   Keep the existing codepoint filter EXCEPT exclude U+0E3F ฿ (currency, not
   a letter — currently inflates a sentence's grade).
2. Lazy memo of the graded corpus (array of `{th, rtgs, en, grade, key}`
   sorted once); `readerFeed(max)` filters it; `startReader` derives counts
   from it. No invalidation needed (static data), but keep `readerFeed`'s
   optional `examples` param working for tests (bypass memo when passed).
**Accept:** reader.test stays green; add a test that `readerGrade("฿") === 0`
(ignored) and that two consecutive `readerFeed(8)` calls return consistent
results. Optional: time `startReader` before/after in the headless harness.

### P1.5 Data-integrity test
New `tests/js/data.test.js` (vm-load data.js, examples.js, tokeniser.js):
- no duplicate `WORDS` keys;
- every `EXAMPLES` key exists in `WORDS`;
- every example's Thai sentence contains its headword literally;
- every Thai token (≥2 chars) in every example sentence resolves through
  `makeTokeniser` over WORDS (same contract as LBB's printed-Thai guard);
- every WORDS row: non-empty rtgs, english, pos, category.
Do NOT fail on words lacking examples (69 today) — that's backlog, not error.
**Accept:** suite green; deliberately breaking a key makes it fail.

---

## P2 — structural cleanups

### P2.1 One HTML escaper
Five copies exist: `_esc` (app.js), `_tcEsc` (curriculum.js), `_bbEsc`
(baht-bus.js), `_sbEsc` (soi-buakhao.js), one in connect4.js — none escape `'`
except `_wcEsc` (wordcard.js, the fullest, vendored).
**Fix:** keep `_wcEsc` as the single implementation; turn the other five into
one-line aliases (`const _esc = _wcEsc;` won't work across files at top level
— make each a function delegating to `_wcEsc`, or replace call sites and
delete). wordcard.js loads before all consumers (check index.html order —
app.js is after wordcard.js; games later still). Do not change `_wcEsc`
itself (vendored; LBB depends on it).
**Accept:** one escaping implementation; `grep -n "replace(/&/g"` web/js
returns only wordcard.js; suites green in both repos.

### P2.2 Escape data at interpolation in learn.js (+1 in sessions.js)
learn.js interpolates data-file strings into innerHTML raw (`${w[0]}`,
`${w[2]}`, `${p.th}`, `${l.intro}`, …) in ~7 render functions;
`sessions.js:228`-area has one raw `${c[2]}`. Data is author-controlled so
risk is low, but make it provably safe:
**Fix:** wrap word/example/lesson-text interpolations with the shared escaper
from P2.1. Do not double-escape strings that already went through it.
**Accept:** grep audit of `${` inside innerHTML template literals in learn.js
shows escaped data fields; UI spot-check (a word card and a chunk lesson
render normally).

### P2.3 Unify RTGS romanization scheme
data.js uses Paiboon-ish (`sǒong`, `pai`, `pen`, `rói`); curriculum.js chunk
lessons use a bp/dt/aaw scheme (`sǎawng`, `bpai`, `bpen`, `ráawy`,
`dtrong`, `jàawt`…). Same words render differently across screens.
**Fix:** convert curriculum.js `GRAMMAR_LESSONS` pattern/practice rtgs to the
data.js scheme. Build the mapping by looking each Thai word up in WORDS where
it exists (ground truth); for words not in WORDS, transliterate consistently
with data.js conventions (no `bp`/`dt` digraphs, `oo` not `aaw`).
**Accept:** `grep -nE "bp|dt|aaw" web/js/curriculum.js` returns nothing;
learn.test green (it asserts pattern shapes, not spellings — verify).

### P2.4 Thai `lang` tagging + minimal ARIA
index.html is `lang="en"`; no Thai element carries `lang="th"`; ~1 aria-label
in the whole app.
**Fix (surgical, not a rewrite):**
1. Add `lang="th"` to the CSS-classed containers that only ever hold Thai:
   `.thai-big`, `.reader-thai`, `.alpha-char`, `.tone-chip`, chart cells,
   `.example-thai`, `.learn-decode-chip` — in the static HTML where present
   and in the render template literals where generated.
2. `aria-label` on icon-only buttons: 🔊 ("Listen"), 🚀 ("Listen at street
   speed"), 🎨 ("Toggle tone colours"), mute buttons, ‹/› lesson nav.
**Accept:** grep counts; VoiceOver/manual spot-check optional.

### P2.5 Promote `toneColorHtml`, share the token-wiring
`toneColorHtml` (curriculum.js) is dead — only its test calls it; reader.js
reimplements the loop inline, plus hand-copies wordcard's token
tooltip/click wiring and learn.js's 🔊/🚀 `_speakBtn` pair, plus a 4th copy of
the `JSON.stringify(x).replace(/"/g,"&quot;")` onclick idiom.
**Fix:**
1. Give `toneColorHtml(thai, decorate?)` an optional per-token decorator
   `(escapedText, tone, rawText) => html`; default = current behavior.
   `_readerThaiHtml` becomes a thin call that supplies the `w-token`/`data-w`
   decorator.
2. Extract wordcard.js's token-wiring loop (tooltip + click→openWordModal)
   into `_wcWireTokens(containerEl)` in wordcard.js (additive — vendored file,
   safe; re-vendor + LBB tests). `showExample` and the reader both call it.
3. reader.js uses learn.js's `_speakBtn` for the 🔊/🚀 pair and `_toneSpeak`
   (or a shared equivalent) instead of inline stringify; deduplicate the other
   inline copies in learn.js (`_speakBtn`, `_wGlyph`) onto one helper.
**Accept:** reader behavior unchanged (headless check: tokens still tappable,
colors still applied, no console errors); reader.test extended to cover the
decorator path; only one stringify-onclick helper remains.

### P2.6 Single source for tone order/labels/colors (+vendoring decision)
The order `["mid","low","falling","high","rising"]` is hardcoded in
`_wToneRead` (learn.js), `_READER_TONE_ORDER` (reader.js), implicitly in
`TONES` row order (data.js), and TONE_LABELS/TONE_COLORS live in
app-only curriculum.js while the engine they describe is vendored.
**Fix:** move `TONE_ORDER`, `TONE_LABELS`, `TONE_COLORS` into thai-script.js
next to the engine (vendored → LBB gets the full contract); delete the
curriculum.js copies; point `_wToneRead` and reader.js at `TONE_ORDER`.
`_detectWordTone` keeps indexing `TONES` (data.js) — add a comment that
`TONES` rows must stay in `TONE_ORDER` order, and a one-line test asserting
`TONES.map(t=>t[1])` deep-equals `TONE_ORDER`.
**Accept:** one definition of each; re-vendor + both suites green.

### P2.7 Capacitor tree drift — DECISION NEEDED, ask the operator first
`android/…/public/` and `ios/App/App/public/` hold stale full copies of the
web app (data.js 1,143 lines vs web's 1,163) with no sync mechanism.
Options: (a) document + script `npx cap copy` as a pre-build step and
gitignore the generated `public/` trees if regenerable; (b) extend
sync-vendored.mjs; (c) delete the trees until the next native build.
**Do not act without the operator's choice.** Present the options and stop.

---

## Backlog (record, don't block on)

- 69 WORDS lack EXAMPLES entries — add over time (vocab-add flow in
  the operator's memory/notes; each example must tokenize fully).
- ว่าง gloss: dedupe left "empty/free (time)"; former WORD_MAP winner said
  "free/available". Merge to `"free/available; empty"` if the operator agrees.
- `toneread` grades into the word's *vocab* SRS card — conflates
  tone-naming skill with word knowledge. Options: separate `tone:<word>` SRS
  key, or don't grade SRS from tone reads. Product decision; ask.
- `_wToneCalc` rebuilds its whole DOM per dial click — harmless now; refactor
  only if the calculator grows state.
- Unreachable `typeof X === "function"` guards (curriculum/learn/thai-script)
  and `_consClass`'s redundant TONE_CLASSES fallback — tidy opportunistically
  when touching those functions; document `CONSONANTS` col 2 as the single
  class source.
- Manifest: add maskable + apple-touch icons (needs image assets — operator).
- Dark-only theme; `local()`-only Thai font — accepted design for now.

## Commit plan

One commit per numbered item (P0.1+P0.2+P0.3 may combine as "housekeeping").
Message style: imperative summary + short body explaining the why (see
`git log` for tone). Run before every commit:

```sh
node --test                              # thaicab suite
node scripts/sync-vendored.mjs --check   # must exit 0 (run sync first if you
                                         # touched a vendored file)
```

…and LBB's `node --test` whenever a vendored file changed. **No pushes; no
LBB commits.**
