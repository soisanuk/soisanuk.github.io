# Word segmentation

Thai is written without spaces, so Paste Text, the graded reader, the word card
and the browser extension all have to decide where words end. `web/js/segment.js`
does that: a dynamic program over the 12,241-word frequency list in
`lexicon-th.js`, minimising the summed cost `log(rank + 10)` of the tokens it
picks. That is a **unigram** model — every word is scored on its own, with no
knowledge of what came before it.

This file records what that costs, four fixes that were measured and thrown
away, and the one that worked.

## The problem, in three examples

**A phrase in the word list always beats its own parts.**

```
ฝนตกหนัก   →  ฝน | ตกหนัก      and ตกหนัก glosses "shoulder a burden"
```

`ตกหนัก` sits in the list at rank 6792. The parse `ฝน|ตกหนัก` costs 15.54; the
correct `ฝน|ตก|หนัก` costs 19.60. One token is cheaper than two whenever the
compound exists at all — that is not a bug in the weights, it is what a
unigram model *is*. Heavy rain became a burden.

**A word the list lacks is not skipped — it is cut into other real words.**

```
โอเลี้ยง  →  โอ | เลี้ยง      "a type of lacquerware" + "to maintain; to dribble"
รีวิว     →  รี | วิว
```

This is worse than an unknown-word path, which the segmenter has and which
renders inert. The pieces are real entries with real glosses, so the reader
gets a confident wrong answer rather than a blank.

**Conventions the model has no opinion about.** ไม้ยมก (`เด็กๆ`), hashtags,
punctuation runs. Not modelling at all — just rules nobody had written down.

## Four fixes that were measured and rejected

Recorded because each is the obvious thing to try, and each is wrong.

**1. A constant per-token penalty** (2026-08-30, see
`chrome-extension-handoff.md` §9). Fixes the *mirror* problem — compounds
losing to their parts, `ที่อยู่` → `ที่·อยู่`. A 30-sentence gold set scored it
free at every setting. Against 940 real sentences it altered 7 and got 3
wrong, including `ที่อยู่` itself in a sentence where it means "who lives at".
Note the direction: raising the per-token cost makes *this* file's problem
worse, so the two failures cannot be fixed by the same dial.

**2. A rank-based PMI proxy.** With Zipf's `P ∝ 1/rank`,
`PMI ≈ log(rank_a · rank_b / rank_ab)` — high when a compound is commoner than
its parts predict, i.e. lexicalised. It does not separate the classes:

| | range |
|---|---|
| lexicalised (ห้องสมุด, รองเท้า, ได้รับ, หน้าต่าง) | −1.30 … 5.99 |
| compositional (ตกหนัก, ออกไป) | −2.88 … 4.20 |

`ตกหนัก` scores 4.03, above `หน้าต่าง` at 1.32.

**3. A rarity ratio** — flag a compound N× rarer than its rarest part. At N=5 it
catches `ตกหนัก` and also flags **1,737 of 12,241 entries**, including วันนี้,
ต้องการ, ตัวอย่าง, หน้าต่าง and `ที่อยู่` — the exact word fix 1 broke.

**4. A crossed-span rate** — how often annotators cut through an entry.
`การ` scores 3.5% because it sits inside thousands of longer words, which is
indistinguishable from `ทำการ` at 5.4%. Pruning the commonest nominaliser in
Thai would have been a spectacular own goal.

**Why they all fail.** Whether `ตกหนัก` is one word or two is a fact about
*context*, and the app ships no context — a word list with an implicit rank and
nothing else. `build-lexicon.mjs` already measured that real TNC frequencies
score within 0.5 F1 of rank, so counts would not have helped either.

## What did work: human annotation

**VISTEC-TP-TH-2021** — Limkonchotiwat, Phatthiyaphaibun, Sarwar, Chuangsuwanich
and Nutanong, ACL-IJCNLP 2021, **CC BY-SA 3.0**. 49,997 Thai social-media
sentences, word boundaries annotated by linguists, `|`-delimited, train/test
pre-split, with the annotation criteria published alongside. A build-time
download, not checked in, exactly like the kaikki dump and the Volubilis
workbook.

It solves both halves at once: it is the gold set we never had, **and** the only
thing that can say whether a lexicon entry is a word. Its criteria settle the
linguistics too — §1.3 makes complex words one token (นักเรียน, ความดี), and
§1.2 applies an insertion test: ลูกเสือ "boy scout" is a compound, ลูกของเสือ
"tiger's cub" is not. ฝน**ตกลงมา**หนัก is sayable, so ตกหนัก is a phrase.

**First honest score: F1 86.96** on the held-out test split. Ten thousand
sentences somebody else labelled — not thirty of our own invention.

## What shipped

Three changes, each measured on that held-out split with nothing derived from it.

**ไม้ยมก belongs to its word** (`segment.js`). `เด็กๆ` is one token; the corpus
writes it that way ~15,000 times in 40k sentences and §1.5 says so. The token
carries `base` so the meaning is looked up under เด็ก. **+0.72 F1 alone.** 22 of
our own example sentences change, all ๆ regrouping; no word boundary moves.

**`seg-extra.js` — sixteen curated words, ours.** Standard loanwords and food
terms the CC0 corpus happens to lack: รีวิว (whole 8,244 times in the corpus),
โอเลี้ยง, ดราม่า, เซเว่น. Appended at the **rarest** ranks on purpose: we assert
"this is a word", never "this is a common word", so no frequency is taken from
anyone's corpus. In this cost model one word beats two nearly regardless of
rank — which is exactly why the gaps did so much damage.

**`seg-phrases.js` — 143 entries removed, CC BY-SA 3.0.** Generated by
`scripts/build-seg-phrases.mjs`: entries the annotators cut through at least 20
times and ≥80% of the time. `ตกหนัก` is 0-whole in 24 occurrences. Its own file
with its own notice because it is derived from their annotations, while
`lexicon-th.js` is CC0 and stays that way — the same boundary `gloss-th.js`
(3.0) and `gloss-vol.js` (4.0) already hold.

**The guard that mattered more than the list.** 36 candidates are course
vocabulary — ภาษาไทย, วันจันทร์, ที่ไหน, พวกเขา. VISTEC's convention splits
them; ours must not, or Paste Text would disagree with the flashcard about the
same word. `build-lexicon.mjs` protects curriculum words for the same reason.

| held-out test, 10,000 sentences | P | R | F1 | exact |
|---|---|---|---|---|
| before | 87.56 | 86.37 | 86.96 | 23 |
| after | **89.19** | **87.52** | **88.34** | **35** |

## Known limits

- **`ทำการบ้าน` now parses `ทำการ|บ้าน`.** Both `ทำการ` and `การบ้าน` are real
  words; the compound entry that masked the ambiguity is gone. No lexicon
  surgery reaches this — it needs bigrams, which need context.
- **The phrase list is a floor.** Only 3,814 of 12,253 entries occur often
  enough in 40k sentences to judge; the rest are unaudited, not endorsed.
- **Conventions differ.** VISTEC is Twitter text and splits `ตอนนี้`, `แล้วก็`,
  `ทำให้`. Where the course teaches a word, the course wins.
- **Over half the remaining disagreement is not about Thai words** — it is
  punctuation grouping and hashtag handling. Cheaper to fix than anything here,
  and untouched.

## The next real step

Bigram transition costs `−log P(wᵢ | wᵢ₋₁)` from the same corpus. `P(มอบ|ขน) ≈ 0`
kills `ขน|มอบ|กรอบ` regardless of unigram frequencies, and `P(ตก|ฝน)` settles
ฝนตกหนัก without touching the lexicon. That is a different segmenter, not a
tuning, and the table has to ship — so cost it before starting.

## Re-running any of this

```sh
# regenerate the phrase list (needs the corpus; it is not checked in)
node scripts/build-seg-phrases.mjs <VISTEC-TP-TH-2021_train_proprocessed.txt>

# the invariants, including ฝนตกหนัก and the course-word guard
node --test tests/js/segment.test.js
```

Scoring against the corpus is not wired into the suite — the corpus is a 40 MB
download and the tests must run without it. `tests/js/segment.test.js` pins the
behaviour the measurements justified.
