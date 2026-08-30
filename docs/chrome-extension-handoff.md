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
licensing (`words_th.txt` is LEXiTRON-derived). **Check the terms before bundling
either into a shipped app or extension** — not checked here, since the spike was local.
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
