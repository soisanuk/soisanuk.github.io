# Handoff: a Thai-reader browser extension

**Status:** research, a segmentation spike, and Paste Text shipped in the trainer.
Written 2026-08-30, updated 2026-08-30. The extension itself is still unbuilt —
but steps 1 and 2 of §4 are done, and step 5's answer turned out to be "no
dictionary needed" (see §7).

**The question that started it:** is there a Chrome extension for Thai learners that
lets you interact with Thai text on any page and drill down through
sentence → word → syllable → individual characters and diacritics?

**Short answer:** no. Nothing does the full stack. The deepest two layers exist only
as websites. This repo already owns those two layers and is missing the shallow one —
which is the inverse of what you'd assume.

---

## 1. What exists, by layer

The Thai extension ecosystem is thin compared to Japanese or Chinese.

| Layer | State of the art | Form |
|---|---|---|
| Sentence → words (segmentation) | thai2english.com | website |
| Word → gloss + romanisation | English ↔ Thai Dictionary (Longdo) | **extension** |
| Word → syllables → tone derivation | thai2english.com, thai-language.com | website |
| Character / diacritic level | thai-language.com | website |

**The one live, maintained extension worth having** is
[English ↔ Thai Dictionary](https://chromewebstore.google.com/detail/english-%3C-%3E-thai-dictiona/lcgmpehgdiaghhhhkaljhamggnbdgdig)
(Longdo-powered) — double-click popup lookup, updated 2025-07-27 (v5.0.0), ~1,000 users,
4.6★. Lookup only: no segmentation, no syllable analysis, no tone derivation.

Also live but shallow: `translit` (romanises non-Latin scripts in-page, Thai included —
transliteration without analysis). General readers Readlang / LingQ importer /
Language Reactor support Thai as one of many languages; segmentation on unspaced Thai
is the part they handle worst.

### Dead ends — don't re-walk these

- **Yomitan has no Thai support.** This is the obvious thing to reach for: Yomichan's
  successor, 20+ languages, exactly the right interaction model. Checked the official
  dictionary list directly — Japanese, Korean, Mandarin, Cantonese, plus Wiktionary
  sets. No Thai. https://yomitan.wiki/dictionaries/
- **The thai2english Chrome extension is dead**, pulled from the Web Store. Source
  survives at https://github.com/madvas/thai2english-chrome-extension but it worked by
  scraping thai2english.com, so assume it is broken against the current site.

### The practical stack for a learner today

Longdo extension for casual in-page lookup, thai2english.com to pull a sentence apart,
thai-language.com to understand *why* a syllable takes the tone it does. Three tools,
two of them not extensions, and a lot of copy-paste.

---

## 2. What this repo already has

Probed 2026-08-30 against the real sources, not read off the docs.

### `web/js/thai-script.js` — the hard layers, already built

This is the valuable part, and it is **vocabulary-independent** — it analyses arbitrary
Thai syllables, not just curriculum words:

- `_consClass(ch)` — consonant class (high / mid / low)
- `_finalKind(ch)` + `_LIVE_FINALS` / `_DEAD_FINALS` — live vs dead syllable
- `_vowelLength(...)` — long vs short
- `toneFromParts(cls, opts)` / `_analyseSyllable(input)`
- `syllableToneInfo(syllable)` / `syllableTone(syllable)`
- `_buildDecomposition(word)`, `_thaiCharKind(cp)`, `vowelDisp(sym, host)`
- `TONE_ORDER` / `TONE_LABELS` / `TONE_COLORS`

`syllableToneInfo` returns exactly the drill-down payload the extension would want:

```
มา     {"cls":"low","mark":"none","live":true,"shortVowel":false,"tone":"mid"}
ไม่    {"cls":"low","mark":"ek","live":true,"shortVowel":false,"tone":"falling"}
น้ำ    {"cls":"low","mark":"tho","live":true,"shortVowel":true,"tone":"high"}
จาก    {"cls":"mid","mark":"none","live":false,"shortVowel":false,"tone":"low"}
สวย    {"cls":"high","mark":"none","live":true,"shortVowel":false,"tone":"rising"}
```

**~~Known gap: initial consonant clusters return `null`.~~ FIXED** (commit `168f852`).
`_analyseSyllable` now reads ควบกล้ำ clusters — the class comes from the first
consonant, with guards for the two shapes that only look like clusters (a
trailing ร/ล/ว is a final: พร; C+ว+final with no written vowel is the reduced
◌ัว: ควบ, สวย). `syllableToneInfo` also reports `cluster` now.

```
ปลวก   {cls:"mid", live:false, cluster:"ล", tone:"low"}
ครับ   {cls:"low", live:false, cluster:"ร", tone:"high"}
เคร่ง  {cls:"low", mark:"ek", cluster:"ร", tone:"falling"}
```

A follow-up commit (`cbcb517`) fixed เ◌ิ, which `_vowelLength` treated as short;
it is the long "oe" (เดิน, เกิด, เลิก). Over the 431 monosyllabic curriculum
words the parser now agrees with the RTGS diacritic on 415, declines 11
(การันต์ + เถอะ/เยอะ), and disagrees on 5 — all loanwords or irregulars.

### `web/js/wordcard.js` — the UI, already built

`openWordModal([thai, rtgs, english])` is the public entry: decomposition, translation,
example sentences, script tooltips, word tooltips. Self-contained apart from globals both
host apps provide (`WORDS`, `EXAMPLES`, `CONSONANTS`, `VOWELS`, `_buildDecomposition`,
`_thaiCharKind`, `_tokenise`, `_tts`) plus the `#wc-overlay` / `#script-tooltip` /
`#word-tooltip` mounts and the `wc-` / `decomp-` / `example-` / `st-` / `tt-` CSS
currently living in `web/index.html`.

`_wcWireTokens(container)` already does tap-to-define + hover-tooltip wiring over
`.w-token` spans — the exact primitive a content script needs.

### `web/js/tokeniser.js` — **not reusable for this**

This is the blocker, and it is worth being blunt about it.

`makeTokeniser(wordMap)` is greedy longest-match against the app's ~950-word curriculum
map. On arbitrary web text it does not degrade gracefully — it produces **confidently
wrong** segmentation:

```js
_tokenise("รัฐบาลประกาศมาตรการใหม่")
// [ {text:"รัฐบาลประกาศ", word:null},          ← whole clause unmatched
//   {text:"มา",  word:["มา","maa","to come"]},  ← FALSE POSITIVE inside มาตรการ
//   {text:"ตร",  word:null},
//   {text:"การ", word:["การ","kaan","the act of"]},
//   {text:"ใหม่",word:["ใหม่","mài","new"]} ]
```

Matching `มา` inside `มาตรการ` and glossing it "to come" is worse than returning
nothing. A curriculum matcher is the right tool inside the trainer, where the corpus is
known; it is the wrong tool for the open web.

---

## 3. The gap, stated plainly

The naive assumption is that we'd have the easy layers and need to build the hard ones.
It is the other way round:

- **We own the layers nothing else has** — syllable analysis, tone-rule derivation,
  character/diacritic decomposition, and the modal that presents them. Verified above.
- **We do not own the layer several existing tools do adequately** — general Thai word
  segmentation over unconstrained text.

So the build is not "port the trainer to an extension". It is **"replace the tokeniser,
then port"**.

---

## 4. If we build it

Rough shape:

1. **Segmentation.** Replace `tokeniser.js` for the extension context.
   **Evaluated — see §6.** Greedy-over-a-real-lexicon works but under-segments;
   frequency-weighted DP is the pick. wasm ICU was not needed.
2. ~~**Cluster support** in `_analyseSyllable`.~~ **Done** — see §2.
3. **Content script** that finds Thai runs in the DOM, segments, wraps as `.w-token`
   spans, and calls the existing `_wcWireTokens`.
   **SPIKED — see §10.** Both halves of this sentence turned out wrong: wrapping
   reflows the page, and `_wcWireTokens` skips non-curriculum words. Build
   `tdWordAt`-style pointer lookup instead.
4. **Bundle the mounts and CSS** currently supplied by `web/index.html` into the
   extension's own shell.
5. **Gloss source.** The 950-word curriculum map will not cover arbitrary text. Either
   ship a real dictionary or fall back to a lookup service for unknown words.

### Constraints inherited from this repo

- `thai-script.js`, `wordcard.js`, `tokeniser.js`, `data.js`, `examples.js` are
  **vendored to The Last Baht Bus** and this repo is the source of truth. Any change made
  for the extension must keep both host apps working, and be followed by
  `node scripts/sync-vendored.mjs`. See CLAUDE.md.
- Classic script tags sharing globals, no ES modules, must work from `file://`. An
  extension bundle may want modules — decide whether the extension consumes copies or
  the files stay module-free and get wrapped.
- Changing the tokeniser's behaviour for the extension **must not** change it for the
  trainer's graded reader (`reader.js` `_readerShow`) or example sentences.

---

## 5. Open questions

- Is this worth building at all, or is the answer "use thai2english.com"? The market gap
  is real but small; ~1,000 users on the only live competitor is not a big audience.
- Extension-only, or does the trainer grow a "paste arbitrary text" mode first? The
  second is cheaper and tests the segmentation work without any extension plumbing.
- Firefox too? Yomitan ships both; the manifest work is mostly shared.

---

## Sources

- Yomitan dictionaries (no Thai): https://yomitan.wiki/dictionaries/
- English ↔ Thai Dictionary: https://chromewebstore.google.com/detail/english-%3C-%3E-thai-dictiona/lcgmpehgdiaghhhhkaljhamggnbdgdig
- thai2english extension source (unmaintained): https://github.com/madvas/thai2english-chrome-extension
- thai-language.com tone rules: http://www.thai-language.com/ref/tone-rules
- translit extension: https://chromewebstore.google.com/detail/translit/eflchmhlhjepplofeonfoaangnhljege
- Thai learning resources 2026: https://studythai.ai/blog/thai-resources-2026


---

## 6. Segmentation spike (2026-08-30)

Ran four segmenters over two test sets. Lexicon: PyThaiNLP `words_th.txt`, filtered
to 60,964 pure-Thai entries ≥2 chars, plus the curriculum map = **61,087 words**.
Frequencies from `tnc_freq.txt` (Thai National Corpus, 106k entries).

Test sets: (a) **30 author-written sentences** in registers the curriculum doesn't
cover — news, signage, official, commercial — with hand-marked boundaries;
(b) the trainer's own **941 example sentences**, as a regression check.

| segmenter | gold F1 | exact | unmatched chars | speed |
|---|---|---|---|---|
| greedy · curriculum (today) | 84.8 | 6/30 | **23.9%** | 1.4M ch/s |
| greedy · 61k lexicon | 91.9 | 15/30 | 0.0% | 1.9M ch/s |
| DP min-tokens · 61k | 91.9 | 15/30 | 0.0% | 0.4M ch/s |
| **DP frequency · 61k + TNC** | **95.0** | **18/30** | 0.0% | 0.4M ch/s |

### What it settles

- **A real lexicon fixes the headline failure.** `รัฐบาลประกาศมาตรการใหม่` segments
  correctly under all three lexicon engines. The `มา`-inside-`มาตรการ` false positive
  is a corpus-size artifact, not an algorithmic one.
- **Greedy survives, but trades one error for another.** Precision jumps 77→99 while
  recall *drops* 94→86: it stops inventing boundaries and starts missing them, merging
  compounds instead of splitting them. For a learner tool that's the better failure —
  a missed split shows a longer phrase, a false split shows a wrong gloss.
- **Frequency weighting is worth the lexicon's second file.** It's the only engine that
  wins on both axes, and most of its residual "errors" are granularity judgments
  (`สูบบุหรี่` vs `สูบ|บุหรี่`, `การประชุม` vs `การ|ประชุม`) rather than mistakes.
- **Speed is a non-issue.** Even the DP runs 0.4M chars/sec; a page with 10k Thai
  characters costs ~25ms. wasm ICU can stay on the shelf.
- **Boundary legality matters more than the lexicon.** Thai boundaries must not split a
  combining cluster. Neither greedy engine enforces this; the DP does, via a one-line
  guard. See the bug this exposed, below.

### What it rules out

**The two tokenisers cannot be unified.** Swapping the lexicon in changes 48% of the
trainer's example sentences, and 365 of 941 would contain a token with no curriculum
gloss — the word modal would open empty. Biasing the DP cost toward curriculum words
does not rescue it: at the best bonus tested, gold F1 falls 95.0 → 91.7 while the
no-gloss count only improves 459 → 374. So:

> Keep `makeTokeniser`/`_tokenise` exactly as-is for the trainer's reader and example
> sentences. The lexicon segmenter is a **separate** entry point for paste-mode and the
> extension, and it needs its own gloss source (§4.5) regardless.

### Bug this exposed, unrelated to the extension

`_tokenise` splits **inside Thai character clusters**, producing tokens that begin with
a combining mark and render as broken text. It happens on 15 of the trainer's own 940
example sentences today:

```
กระเป๋าใบนี้หนักมาก   →  กระเป๋า | ใ | บน | ี้ | หนัก | มาก
อย่าทำตัวโง่แบบนั้น   →  อ | ย่า | ทำ | ตัว | โง่ | แบ | บน | ั้น
บริษัทกำลังสร้าง…     →  บริษัท | กำลัง | สร้าง | อาคา | รส | ูงแห่ง | ใหม่
```

A bigger lexicon makes it *worse* (35 broken tokens), because more candidate words means
more chances to cut badly. The fix is the legality guard, not the lexicon:
a boundary at position `p` is illegal when `s[p]` is a combining mark
(U+0E31, U+0E34–U+0E3A, U+0E47–U+0E4E). With it, both DP engines score zero broken
tokens. **This is worth fixing in the trainer on its own merits.**

### Before shipping any of this

The lexicon and frequency files come from the PyThaiNLP corpus and carry upstream
licensing. ~~`words_th.txt` is LEXiTRON-derived.~~ **CHECKED 2026-09-02, and that
claim was wrong.** PyThaiNLP's own `corpus/corpus_license.md` lists `words_th.txt`
and `tnc_freq.txt` under **CC0-1.0**, in a "Dictionaries and Word Lists" section
that also carries a separate CC BY-SA 4.0 group for other files (Volubilis, Thai
Wikipedia Titles) — ours are not in it. LEXiTRON and NECTEC appear nowhere in that
file. The derivation claim here was unsourced, and `lexicon-th.js`'s header cites
the licence file correctly.

The residual caveat, stated honestly: upstream *declaring* CC0 is not the same as
upstream *being entitled* to. If this ever ships commercially rather than as a
personal tool, that is a question for PyThaiNLP, not for a code comment.
Size is also a real question: ~1.5MB raw each, versus `data.js`'s 79KB. Ship it as a
fetched asset, not a `PRECACHE` entry.

Spike code (throwaway, not committed): `seg.mjs` / `eval.mjs` / `gold.mjs` /
`broken.mjs` / `biased.mjs` in the session scratchpad.


---

## 7. Paste Text — §4 step 1 answered by shipping it

The spike's recommendation was to test the segmentation work inside the trainer
before touching any extension plumbing. That is now built: **📝 Paste Text**,
nav `P` (`segment.js` + generated `lexicon-th.js` + `paste.js`).

What it settled that the spike could not:

- **The gloss problem (§4 step 5) dissolves, then gets solved anyway.** The
  worry was that the 950-word map can't cover open text, so we'd need to ship a
  dictionary or call a lookup service. First finding: the layers this repo
  uniquely owns — character decomposition and tone derivation — work from
  **spelling alone**, so an unknown word is still worth tapping with no
  dictionary at all. Second finding: a bundled dictionary turned out to be cheap
  after all. `gloss-th.js` (see §8) glosses 97% of the thousand most common Thai
  words in 363KB, generated from English Wiktionary via kaikki.org. **No lookup
  service, no network at runtime.**
- **240KB of lexicon is affordable.** 12k frequency-ranked words scored the same
  as the full 61k on the gold set, shipped as a rank-ordered list with no counts
  (rank-derived Zipf cost is within 0.5 F1 of real corpus frequencies). Lazily
  injected as a `<script>` so it still works from `file://`, and kept out of
  PRECACHE so it costs nothing until used.
- **Both segmenters can coexist cleanly.** The reader and example sentences keep
  `_tokenise` untouched; Paste Text is a separate entry point. They share only
  `_tkLegalBoundary`, so they agree on where a cut may fall.

### What this means for the extension

Steps 3 and 4 of §4 are now the only real work left, and both shrank:

- The content script needs `segmentThai` + `_wcWireTokens`, both of which exist
  and are exercised by a real screen.
- Paste Text is effectively the extension's popup, minus the DOM walking. What
  it does NOT prove is finding Thai runs in someone else's markup without
  breaking their page — that is the genuinely untested part.

Still open: whether the extension is worth building at all (§5), which Paste
Text does not answer — it makes the value concrete for *this* app's users, and
those are not the same audience.


---

## 8. The dictionary — kaikki.org, CC BY-SA (2026-08-30)

Shipped as `web/js/gloss-th.js` + `gloss.js`, generated by `scripts/build-gloss.mjs`.

**Source: kaikki.org's Thai extraction** (`kaikki.org-dictionary-Thai.jsonl`,
~45MB, Tatu Ylonen's wiktextract run over **English** Wiktionary). It carries
`word` / `pos` / `senses[].glosses` in English, plus IPA and romanisation.

### Rejected, with the reason — don't re-walk these

- **PyThaiNLP `thai_dict`** (CC BY-SA 4.0, 4.5MB) is extracted from **Thai**
  Wiktionary, so it is monolingual: เดิน → "ยกเท้าก้าวไป". No use to an
  English-speaking learner. This is the trap — it is the obvious hit when you
  search the PyThaiNLP corpus catalogue for a dictionary.
- **FreeDict** has no tha-eng pair (404).
- **Longdo / LEXiTRON** — API or registration-gated, not redistributable.
  Re-checked 2026-09-02: `lexitron.nectec.or.th` now serves only "Site Under
  Construction" (© 2025 NECTEC), so there are no published terms to read at all.
  A dependency whose licence page does not exist is not a dependency.

### What shipped

7,567 of the 12,241 lexicon words. Headline coverage is 61.8% — lower than the
first cut because entries whose only content was a redirect ("alternative form
of X") are now dropped rather than shown. It is front-loaded where it matters:

| lexicon rank band | glossed |
|---|---|
| top 1,000 | 97% |
| 1,000–3,000 | 86% |
| 3,000–6,000 | 72% |
| 6,000–12,241 | 49% |

Ordinary prose comes out fully glossed. The misses are mostly compound function
phrases English Wiktionary simply lacks (หรือไม่, ส่วนใหญ่, รวมทั้ง, ดังนี้).

### Romanisation — converted, then verified against our own tone engine

kaikki tags three systems, and none matches the course out of the box:

| | ตำรวจ | สวย | น้ำ |
|---|---|---|---|
| Paiboon | dtam-rùuat | sǔai | náam |
| Royal Institute | tam-ruat | suai | nam |
| **this course** | tam-rùat | sǔay | náam |

The house style is Paiboon's tone marks over RTGS-style consonants, so the
generator converts Paiboon (Royal Institute is unusable — no tone at all).
Validated against the 739 curriculum words present in both: **88.5% exact**.
Of the 85 misses, 67 differ only in vowel-length spelling and 13 in `-ai`/`-ay`
— cosmetic. Tone-mark disagreements are down from 24 to **5**, because 23 of
them turned out to be errors in `data.js` and were fixed (see below). Every
derived form is still cross-checked against `syllableTone` and dropped on
conflict; 29 dropped, 99.4% keep a romanisation.

A side benefit: several of those disagreements are errors in `data.js`, not in
Wiktionary (`คะ khâ` should be `khá`, `กรุณา ka-` should be `kà-`), so the
comparison doubles as an audit of the course's own romanisations.

### The licence consequence, stated plainly

`lexicon-th.js` is CC0 and costs nothing. `gloss-th.js` is **CC BY-SA 3.0**:
attribution is required (rendered on the Paste Text screen) and the file itself
carries share-alike. It does not infect the app's code — share-alike attaches to
the derived database — but any extension reusing this file inherits the same
obligation, and would need its own visible credit. That is the one new string
attached to going down this road.


---

## 9. Measured and rejected: a per-token segmentation penalty (2026-08-30)

The 2026-08-30 learner persona round found 23 lexicon compounds that lose to
their own parts — `ที่อยู่` (address) → `ที่ · อยู่`, `ต่อว่า` (to scold) →
`ต่อ · ว่า`. Cause is real: `segment.js` scores pure unigram surprise with no
per-token cost, so splitting into two very common words is nearly free
(`ที่อยู่` ≈ 5.94 vs ≈ 5.8 for the split — it loses by a hair).

A constant per-token penalty fixes that class, and **the gold set says it is
free**: boundary-F1 is 95.0 at every penalty from 0 to 3. That is the gold
set being blind, not the change being safe.

Scored by what actually changes over the 940 curriculum example sentences, a
penalty of 0.5 alters 7 sentences and only 4 are improvements. The two failures
that matter:

| sentence | merge | why it's wrong |
|---|---|---|
| คุณปู่แก่**แล้วแต่**ยังแข็งแรง | `แล้ว·แต่` → `แล้วแต่` | here it is "already **but** still", not the compound "it depends" |
| แม่เป็นห่วงลูก**ที่อยู่**คนเดียว | `ที่·อยู่` → `ที่อยู่` | here it is "the child **who lives** alone", not "address" |

`ที่อยู่` — the exact word the change was for — is genuinely ambiguous, and
only context separates the two readings. A unigram DP has none, so the penalty
trades one error class for another at roughly 1:1.

**Rejected.** Splitting is the milder failure: it still shows two correct
glosses and merely misses a compound sense, where a wrong merge asserts
"address" in a sentence that does not mean that. Doing this properly needs a
bigram or context model. Don't re-attempt it with a constant.

---

## 10. Step 3 spiked — and it changed the design (2026-09-01)

`spike/thai-dom.js` + `spike/fixtures/hostile.html` + `spike/run.mjs`.
Run it with `node spike/run.mjs` — 24 checks, all passing.

**Verdict: step 3 is tractable, but not the way §4 describes it.** Two of that
section's assumptions are wrong, and one of them only shows up on a real page.

### The approach §4 assumed — wrap every word — reflows the page

The obvious content script finds Thai text nodes, segments them, and replaces
each with `<span class="w-token">` wrappers. Built, and it survives everything
a hostile page can do: `contenteditable`, `textarea`, `input`, `<script>`,
shadow roots (reached via the TreeWalker), re-scans without double-wrapping,
React-style re-renders, block boundaries not mistaken for split words, and
punctuation/Latin/spacing preserved byte-for-byte. 21 checks.

Then it was pointed at th.wikipedia.org, and:

- `textContent` — **byte-identical**, 47,586 characters. Nothing lost.
- `innerText` — **7 characters different**. `เมนูหลัก` rendered as `เมนู` /
  `หลัก` across two lines.

Thai is unspaced, so a run the browser could not break mid-word becomes a row
of inline boxes it *can* break between. The content is perfect and the layout
moved. On somebody else's page that is its own kind of damage, and no amount of
CSS on our spans reliably prevents it.

### What to build instead: find the word under the pointer

`tdWordAt(x, y)` uses `caretPositionFromPoint` to get the text node and offset,
walks out to the Thai run, segments **that run only**, and returns the token
containing the offset plus a `Range` rectangle for drawing a highlight as an
overlay. Measured on the same page:

| | wrap every word | word under pointer |
|---|---|---|
| `innerText` | changed | unchanged |
| `innerHTML` | rewritten | byte-identical (310,005 → 310,005) |
| cost | 33–159 ms per full scan | **0.015 ms** per lookup |
| `contenteditable` | must be skipped | readable, since nothing is written |
| survives a re-render | needs re-scanning | nothing to survive |

591 of 1,508 probe points across the article landed on a real word — อาหาร,
บทความ, อภิปราย, แก้ไข, หน้าตา — with no DOM mutation at all.

### Split words: 36.7% of nodes, but 5.2% of what a reader points at

A word split across an inline tag (`<b>ส</b>วัสดี`, or a stranded combining
mark) cannot be segmented from one text node. Detection is exact — on the
fixture it flags precisely the five nodes belonging to the two split words, and
does not flag the block boundary, the link, the mixed-script line, the shadow
root or the re-render.

On Wikipedia **36.7% of Thai text nodes** are at a boundary (it links heavily,
mid-sentence). But that is the wrong denominator for the pointer design: only
**5.2% of actual word hits** sat on a boundary. Joining adjacent inline text
nodes before segmenting would close most of that, and is the obvious next step.

### Two smaller things the spike settled

- **`_wcWireTokens` is the wrong function to reuse**, though §4 names it. It
  looks each word up in `_wcMap()` and returns if it is missing — on open text
  almost every word is missing, so almost every token would be inert.
  `paste.js` already hit this and grew `_pasteWireTokens`; the extension needs
  that shape, not wordcard's.
- **A token inside `<a>` never receives its click.** Measured: with a plain
  listener the browser navigated first and took the handler, the page and the
  listener with it. `preventDefault()` *and* `stopPropagation()` are both
  required — they defend against different things (the link's own navigation,
  and the host page's delegated handlers).
- **`segment.js` hardcodes `el.src = "js/lexicon-th.js"`** (line ~90). That
  relative path cannot resolve in a content script; it needs
  `chrome.runtime.getURL`, which is the first real fork between the app build
  and an extension build.

### Still not answered

Whether to build it (§5). The spike says the hard part is cheap and the design
is clear; it says nothing about the ~1,000-user market or the CC BY-SA
obligation `gloss-th.js` carries into a distributed extension (§8).

---

## 11. Built (2026-09-02)

`extension/` loads. `chrome://extensions` → Developer mode → Load unpacked →
select `extension/`. Hold **Alt** and point at Thai; Alt-click opens the card,
Escape closes it. Without Alt held it does nothing whatsoever.

Verified by driving the real unpacked extension in Chrome —
`node spike/ext-check.mjs`, 10 checks, plus `node spike/shell-check.mjs` for
the shadow-root isolation.

### It is packaged from the app, not written twice

`extension/vendor/*.js` are copies of `web/js` sources and `extension/shell.css`
is extracted from `web/index.html`, both by `scripts/build-extension.mjs`, with
`--check` failing on drift. An extension that keeps its own copy of the tone
engine is one that quietly stops matching the app it came from.

Bundle: data.js, examples.js, thai-script.js, tokeniser.js, wordcard.js,
lexicon-th.js, segment.js, gloss-th.js, gloss.js, thai-dom.js — about 1MB, no
network at runtime.

### The three things that made it work

- **Nothing is written to the page.** `tdWordAt` finds the word under the
  pointer and a `Range` gives its rectangle, which is drawn over as an overlay.
  §10 measured why: wrapping words in spans reflows unspaced Thai.
- **The card lives in a shadow root**, so its CSS and the page's cannot reach
  each other. The host element carries `all: initial !important` — a shadow
  root blocks selectors, not inheritance, and an ordinary inline declaration
  loses to a page's `!important`.
- **Alt is the entire activation surface.** No modifier, no behaviour: no
  lookup, no highlight, and clicks reach the page untouched. An extension that
  pops a dictionary on every hover makes the web worse everywhere it is
  installed.

### Tone colour, and where it can honestly go

The app paints Paste Text and the Reader by tone. The extension cannot do that
to somebody else's page: repainting text means wrapping words in spans, which
is the thing §10 measured as reflowing unspaced Thai. So the tone goes on the
surfaces that are ours — the highlight drawn over the word, and the tooltip's
headword, which was otherwise always saffron and said nothing.

`toneOfWord` (curriculum.js, bundled for that one function) abstains on
anything whose romanisation shows more than one syllable, and the extension
abstains with it: วันนี้ and อากาศ stay the default pink rather than being
painted a colour that would be false for half the word. Same rule as the app.

### The gloss gap, and the plan to close it

Wiktionary glosses 62% of the 12,241-word lexicon. The other 38% are words the
segmenter knows and no dictionary layer does — and they are not rare: ความรู้สึก
("feeling") is lexicon rank 369, บทสนทนา and สนทนา are ordinary. A reader hits
one within a paragraph.

Three layers now, in precedence order (`gloss.js`):

1. **`WORD_MAP`** — the 950 course words, hand-written.
2. **`gloss-extra.js`** — hand-curated supplement, this project's own. For
   words hit in practice, and the only way to override a wrong Wiktionary
   gloss without editing generated output. Every entry's tone marks are
   checked against the engine by `tests/js/gloss.test.js`.
3. **`gloss-th.js`** — the Wiktionary layer, CC BY-SA 3.0, generated.

### Volubilis, measured (2026-09-03)

`VOLUBILIS Duo Max ENG.xlsx` (SourceForge, 8.2MB, v24.3 Nov 2024) parsed
directly from the OOXML — 105,258 rows, **94,499 distinct Thai headwords**.
Columns: A romanisation, D Thai, E English.

**Coverage of our lexicon is the number that matters, and it is good:**

| | words |
|---|---|
| lexicon | 12,241 |
| gloss-less today | 4,470 (36.5%) |
| of those, Volubilis has | **3,595 (80.4%)** |
| gap after adding it | **875 (7.1%)** |
| top-1,000 gloss-less | 46 → Volubilis fixes **45** |

It is also nearly a superset of what we already gloss: of 7,771 words with a
gloss today, Volubilis has 7,448 and lacks 323.

**Glosses are usable as-is.** Median 17 characters, p90 49. But it is a
sense-list dictionary — 2,947 entries carry more than five `;`-separated
senses, and the longest is 239 characters. The card wants the first sense or
two, not the list, so the builder must truncate the way `build-gloss.mjs`
already does for Wiktionary.

**The romanisation is NOT usable.** Volubilis uses its own scheme with macrons
(`khwām rūseuk`, `ā`, `yǿm`) and **97% of its monosyllabic entries carry no
tone mark at all** — of 4,941 checked, 4,814 are unmarked and only 18 of the
marked ones agree with our tone engine. Take the glosses; keep deriving
romanisation from `thai-script.js` and the Wiktionary Paiboon layer.

### Cross-referenced against what we already ship (2026-09-03)

Meanings compared by SENSE OVERLAP, not string equality — both sides are
`;`-separated sense lists, so "to buy" vs "buy; purchase" is agreement. Score
is containment over content words, stop-words and parentheticals stripped.

| | shared | strong (≥50%) | partial | **no shared word** |
|---|---|---|---|---|
| course words (hand-written) | 846 | 714 (84.4%) | 18 | **114 (13.5%)** |
| Wiktionary layer | 6,520 | 4,613 (70.8%) | 642 | **1,265 (19.4%)** |

**The disagreements are mostly one systematic thing: Volubilis's FIRST row for
a spelling is often a homograph, not the common word.** มา row 0 is "moon", not
"come"; เขา is "mount; mountain", not "he"; ดี is "gallbladder", not "good";
ต่อ is "wasp". 3,162 of our lexicon's headwords have more than one Volubilis
row, and taking row 0 blindly disagrees with us on 1,460 of them — but for 513
of those, a LATER row for the same word agrees (ที่ best-of-6 is "who; which;
that", ของ best-of-3 is "of; belonging to").

So the builder must **not** take the first row. It has to pick among a
headword's rows, and the only sound chooser we have is our own existing gloss:
prefer the row that overlaps it, fall back to row 0 only when nothing is known.
That makes Volubilis excellent at FILLING GAPS and unsafe as a REPLACEMENT —
exactly inverting the plan below.

The 947 with no agreeing row on any line are a genuine editorial split, not a
bug on either side: Volubilis gives the concrete noun (พระ "Buddhist monk",
รูป "photo", นาย "master"), Wiktionary the grammatical or abstract sense
("god, deity", "outward appearance", "man"). Both are true; they are different
dictionaries. 23 of the 114 course-word disagreements are top-100 words, which
is precisely where the hand-written course gloss should keep winning — and it
already does, since WORD_MAP sits above every dictionary layer.

### The plan, now that it is measured

- **Volubilis becomes a GAP-FILLER, not the primary layer** — revised after the
  cross-reference above. `gloss-vol.js` sits BELOW Wiktionary, consulted only
  when nothing else has the word. That is where its 3,595 new words live, and
  it never gets to overwrite an existing gloss with a homograph.
- **Row selection is the builder's real work.** For a word we already gloss,
  pick the Volubilis row that overlaps our gloss (this is what rescues ที่,
  ของ, มา). For a word we do not, take row 0 and accept the homograph risk —
  which is bounded, because a word with no gloss anywhere is usually rare
  enough to have only one row.
- **Attribution on the card gains a second line.** Both sources are BY-SA; 3.0
  and 4.0 coexist in the stack because each file keeps its own notice and
  nothing merges them into one database.
- **The supplement stays on top**, for the ~875 words neither has and for
  overriding either.
- **Not done here:** the download is a manual step (the file is not checked in,
  like the kaikki dump), and 875 words would still have no gloss — the tail is
  the tail.

### Notes for whoever touches it next

- `app.js` is deliberately absent: `_wcMap()` falls back to building from
  `WORDS`, so `WORD_MAP` is not needed. `EXAMPLES` is guarded too — but
  examples.js is bundled anyway, because the example sentence is most of why
  the card is worth opening.
- `_tts` is NOT guarded in wordcard.js, so `extension/tts.js` is required
  rather than optional; it is a small Web Speech implementation, since the
  app's tts.js touches the DOM at load and is wired to a mute button that does
  not exist here.
- `segment.js` hardcodes `el.src = "js/lexicon-th.js"`. Declaring the lexicon
  as a content script means `THAI_LEXICON` already exists and `_segLoad`
  short-circuits, so that path is never taken. If the lexicon is ever loaded
  lazily here it will need `chrome.runtime.getURL`.

### Still not done

`<all_urls>` with no options page, no per-site toggle, and no icons. Fine for
loading unpacked; all three would be needed before anyone else installs it.

The CC BY-SA attribution `gloss-th.js` carries (§8) is **done** — the card shows
"Meanings from Wiktionary, used under CC BY-SA 3.0" with both links, appearing
and disappearing with the card rather than sitting permanently on every page you
browse. It was added before the extension went anywhere, on the grounds that it
is a two-minute change now and an awkward thing to remember later.

Worth recording for whoever revisits the gloss source: **Volubilis**
(belisan-volubilis.blogspot.com, ~105,000 Thai-English entries with romanised
Thai, actively maintained) is **CC BY-SA 4.0** — confirmed on its About page. It
is not a way out of share-alike, but it is a far bigger dictionary at the same
licence cost, and switching to it would leave a single BY-SA 4.0 source instead
of BY-SA 3.0. The deciding measurement — how much of our 12,241-word lexicon it
covers against Wiktionary's 61.8% — has not been made. LEXiTRON is not an
option: see §8.
