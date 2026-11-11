# Provenance of the course data

Recorded 2026-11-11 against commit `84eb8ac`, from the git history, the
commit messages and file headers, and what is still on disk. It covers the
files a content pack would export (`data.js`, `curriculum.js`,
`examples.js`). The machine-readable copy is [PROVENANCE.json](PROVENANCE.json).
Where something could not be established, this file says **unknown** rather
than guessing.

## Summary

All three files were written in this repository by Mario De Tore working with
Claude (Anthropic). Of the commits touching them, all but three to four per
file carry a `Co-Authored-By: Claude …` trailer. No third-party word list,
dictionary or textbook text was found copied into them. There are three open
questions, and only Mario can answer them:

1. **What the original Python app's data came from.** `data.js` was imported
   whole in the first commit (`255576b`, 2026-07-02): 884 word rows, plus the
   consonant, vowel and tone tables. Its header at the time read
   `// Auto-generated from thaicab/data/thai_script.py and thaicab/data/words.py`.
   That Python project was never committed here. It is not on disk at
   `~/thaicab` or elsewhere, and no transcript of its creation survives. The
   first commit is co-authored by Claude Sonnet 4.6, which suggests the data
   was LLM-generated, but suggests is all the evidence allows. **Unknown.**
2. **The licence for this project's own material.** There is no LICENSE file
   and there never has been one in history. **Unknown — not yet chosen.**
3. **The commit identity on the first seven commits.** Seven commits from
   2026-07-02 to 2026-07-03 were made under a former work email address.
   Every later commit uses a personal identity. On 2026-11-12 the history
   was rewritten so that all seven carry
   `Mario De Tore <soisanuk@users.noreply.github.com>`, the identity the
   other 186 commits already used; the repository no longer records the
   former address anywhere. The rewrite changed every commit hash in the
   repository, and the hashes cited in this file are the rewritten ones.
   This record says nothing about what machine those seven were made on,
   or at what time, and the repo cannot tell.

## Per source

| Source | Author / upstream | Licence | Attribution owed | Evidence | Confidence |
|---|---|---|---|---|---|
| `data.js` WORDS, as imported (884 rows: Thai, romanisation, gloss, category) | Generated from an unrecorded Python app (`words.py`), authorship of its contents **unknown** | **unknown** | **unknown** | `git show 255576b:web/js/data.js` header; initial commit co-authored by Claude Sonnet 4.6 | low |
| `data.js` WORDS, rows added since (884 → current) and corrections | Mario De Tore with Claude; many words requested by The Last Baht Bus (Mario's own project) | none stated (first-party) | none known | 50 commits, 47 with Claude co-author trailers | high |
| `data.js` consonant, vowel and tone tables | Imported with the above from `thai_script.py`; the contents are standard facts of the Thai script | **unknown** for the original file; the facts themselves are not copyrightable | none known | as above | medium |
| `data.js` CONS_NAME_EN (13 glosses for acrophonic letter names) | Mario De Tore with Claude, 2026-09-05; prompted by reading a Thai SOLT I lesson, whose wording was not copied | none stated (first-party) | none | `406d7c3` ("The prose is all ours") | high |
| `curriculum.js` LETTER_BATCHES, COURSE, GRAMMAR_LESSONS, TONE_READ_WORDS, TONE_EXCEPTIONS, teaching notes | Mario De Tore's brief (2026-07-17) built by Claude. The letter order was computed to maximise decodable words from WORDS, not taken from a corpus or course | none stated (first-party) | none | `654390e`; curriculum.js:12-16; 23 commits, 19 with Claude trailers | high |
| `curriculum.js` CONS_CONTRASTS, CONFUSABLE_CONS | Mario De Tore with Claude. The idea for the drills came from comparing the course against a Thai SOLT I alphabet lesson. The pairs are derived from WORDS | none stated (first-party) | none — ideas only were taken | `406d7c3`; curriculum.js:134-142 | high |
| Tone and decodability helpers' outputs | Computed by this repo's code from the data above | follows the data | follows the data | curriculum.js, thai-script.js | high |
| `examples.js` (sentence, romanisation, translation) | Imported with the first commit (no generator header), then edited and extended by Mario De Tore with Claude | **unknown** for the 2026-07-02 import; first-party since | **unknown** for the import | `255576b`; 37 commits, 35 with Claude trailers | medium |

## Contact with the third-party sources

The CC0 and CC BY-SA files in this repo are `lexicon-th.js` (CC0),
`gloss-th.js` (Wiktionary, CC BY-SA 3.0) and `gloss-vol.js` (VOLUBILIS,
CC BY-SA 4.0). None of the three is imported by `data.js`, `curriculum.js` or
`examples.js`, and no bulk copy from them was found. Two kinds of contact did
happen, and they are disclosed here because they would not show up in a grep:

- **Corrections were made by cross-checking against Wiktionary.** In
  `9217bf0`, about 950 glosses were checked, and fixes such as เงาะ
  "rambutan" were made. In `0ff476c`, กะเทย took the dictionary's romanisation
  *thooei*. In `bc62e01`, about 50 words were corrected. Each correction
  changed a single fact (one gloss or one romanisation), and most were
  decided by the tone engine and by the sibling entries in WORDS.
- **Tests compare WORDS with gloss-th.js** (corpus agreement). That checks
  the data; it does not copy from the dictionary.

The Thai SOLT I material is understood to be a Defense Language Institute
publication. That has not been verified. Only ideas were taken from it (which
drills the course lacked), and ideas are not copyrightable.

Audio and images are out of scope: no consumer of this file needs them.

## Native review, the bonus lesson and the grammar export (added 2026-11-11)

- **Native review record.** `EXAMPLE_REVIEWS` in `web/js/grammar.js` lists
  the 25 example sentences a fluent native Thai reader approved, each with
  the exact wording they approved and the commit that recorded it: 7 in
  `1bba41f`, and 18 of the 19 in `dc3e5bb`. The 19th, ขาว, is not counted,
  because its sentence was rewritten after the review and never re-read. A
  sentence keeps its ✓ only while it still reads exactly as approved, and a
  test fails if one drifts. The record does not name the reviewer
  (**unknown**). Everything else in `examples.js` is LLM-authored and
  machine-checked, not natively verified.
- **Bonus lesson g9 "Whose is it?" (ของ)** and each lesson's `markers` were
  written by Mario De Tore with Claude. g9 is not on the Guided Course
  spine. It appears only on the in-app Grammar & Examples screen and in the
  export.
- **`export/grammar.json`** is generated by `scripts/export-grammar.mjs`, and
  CI fails if it drifts. It carries its own provenance block with the label
  "LLM-authored course content, machine-checked, partially native-reviewed.
  Not verified." and licence **unknown**. Its per-token glosses for non-course
  words come from Wiktionary (CC BY-SA 3.0) or VOLUBILIS (CC BY-SA 4.0), and
  each token is tagged with its gloss source.

## Consonant recordings (added 2026-11-11)

`web/audio/letters/*.mp3` holds 42 clips, each a consonant followed by its
name, in a native speaker's voice. They were cut by
`scripts/cut-letter-audio.mjs` from **DLI Thai SOLT I, Supplementary Listening
Comprehension Workbook, Modules I-III, Track 1**. The local file is "Thai L
Workbook 2 Audio M1-6/01 Track 1.wma". Its script is on p.2 of "Audio WB
1-3_Instr_Feb03Final.pdf". The only changes are the cuts, mono downmix, 3 dB
of gain reduction and 20-40 ms fades.

- **Author:** the Defense Language Institute's Special Operations Language
  Training course. The PDF metadata names Anthony Burgard and Charatpim
  (Prayutsenee) Burgard. The speaker is not named.
- **Licence:** believed to be a US Government work and so public domain
  (17 U.S.C. §105). The mirror these files came from
  (fsi-language-courses.org) states "These courses are in the public domain
  and free to use". No file carries its own copyright notice or a
  public-release statement, and **whether the authors were federal employees
  or contractors is unknown**, so this is the owner's call. It is not a
  verified fact.
- **Attribution:** none legally required if public domain. Credited here
  anyway.
- **Content check:** the clips' order follows the printed script, and the
  owner confirmed that the track speaks each letter with its name. A
  listen-through of all 42 in alphabet order is recorded in the commit that
  ships them.

## Vocabulary from DLI Thai SOLT (added 2026-11-11)

153 words were appended to `WORDS` in `data.js` under the heading "Everyday
Pattaya, from the DLI Thai SOLT course", with an example each in
`examples.js`.

- **Selection:** from SOLT Modules 3-5 vocabulary lists (food, lodging,
  banking, post, directions, transport, weather, health). The words are
  everyday Thai, so the list itself carries no copyright weight. The
  romanisation, glosses and categories are ours.
- **Examples:** 56 are quoted word for word from SOLT. They are recorded in
  `grammar.js` `EXAMPLE_SOLT`, each with its lesson and page, and checked by
  substring match against the extracted SOLT text. These are native-written
  Thai. 11 more were adapted from SOLT patterns (ผม or ครับ added), and 86
  were written for this course. Neither group counts as native-sourced.
- **Licence:** as for the recordings above: believed public domain (US
  Government work), not verified.
- **Side effects:** `seg-phrases.js` was regenerated from VISTEC-TP-TH-2021
  (downloaded 2026-11-11), because ข้างใน and ไม่ค่อย are now course words
  and must not be pruned.

## Listening recordings, transcripts and questions (added 2026-11-11)

`web/js/dialogues.js` and `web/audio/dialogues/*.mp3` hold 73 tracks from
the **DLI Thai SOLT Supplementary Listening Comprehension Workbooks**,
Modules I-VI, with the workbooks' own questions and answer keys.

- **Recordings:** the course's WMA tracks, converted to mono MP3 with loudness
  normalisation and a peak limiter. They are not cut or edited. The folder
  and file of each track are recorded in `dialogues.js`.
- **Transcripts:** the instructor workbooks' "Audio Script" for each track.
  Only text-extraction damage was repaired, and every repair is listed in
  that track's `repairs`. Thai wording and digits are as printed.
- **Questions and answers:** verbatim from the instructor workbooks (263
  questions). None is written by us. Questions the workbook gives no key for
  are omitted. Where a key seems not to match the transcript, the learner
  sees a note, and the key itself is unchanged.
- **English translations:** written for this app (by Claude, reviewed in
  session). They are not SOLT's.
- **Excluded:** military or operational tracks; drills and word lists; a
  track whose printed script is cut short (Module 1 Lesson 5 Track 13); and
  "At the garage" (Module 4, Track 20), whose printed speaker turns
  contradict each other.
- **Not verified by ear:** each track is matched to its script by duration,
  speech rate and pause counts. The owner listened to the alphabet track
  only.
- **Licence:** as for the other SOLT material above: believed public domain
  (US Government work), not verified.

## SOLT rights: new evidence (2026-11-11, later the same day)

The original Word files of the SOLT course were found in a second download
("DLI-Thai-Complete", byte-identical audio and PDFs plus the .doc sources).
Their metadata weakens the "US Government work" assumption recorded above:

- **Company fields:** "Anthony Inc.", "U of A South", "Arizona State
  University".
- **Authors:** Anthony Burgard, Charatpim Burgard, C Prayutsenee. The last
  editor is "gerda" / Ruth Hjelm.
- **Created:** 2000-09 to 2004-03.
- **Statements:** no copyright, distribution, public-release or DLI
  statement anywhere, in any file. The only provenance text is the cover
  "Special Operations Language Training (SOLT)".

Special Operations language training has often been delivered by
contractors and universities. If this course was produced under contract,
the contractor may hold copyright, and the public-domain assumption would
be wrong. **The licence of everything marked SOLT in this file is therefore
unknown, not "believed public domain".** That covers the letter
recordings, the Listening tracks and questions, and the 56 quoted
sentences. The owner has been asked how to proceed.

By contrast, the DLIFLC **Language Survival Guides** (Thai Basic and Thai
Naval, May 2008) state that DLIFLC produced them. They are a much clearer
case of a US Government work. Nothing from them has been used yet.

## SOLT rights: the owner's determination (2026-11-11)

This supersedes "licence unknown" for all SOLT material above: the letter
recordings, the Listening tracks, transcripts and questions, and the 56
quoted sentences. The owner issued this disclaimer (verbatim):

> **PROVENANCE AND COPYRIGHT DISCLAIMER: SPECIAL OPERATIONS LANGUAGE TRAINING (SOLT) AUDIO**
>
> 1. ORIGIN, PROVENANCE, AND ACADEMIC PARTNERSHIP
> The audio assets utilized in this project originate from the Special Operations Language Training (SOLT) curriculum. These specific instructional materials were researched, designed, and developed by the US Army John F. Kennedy Special Warfare Center and School (USAJFKSWCS) in direct academic association with the University of Arizona and its contracted development partners (including South Camber / Advanced Computer Learning Company).
>
> 2. DATA RIGHTS AND PUBLIC DOMAIN RELEASE
> These materials were produced under United States federal defense training frameworks. The Department of Defense holds Unlimited Rights to distribute, reproduce, and authorize public utilization of this curriculum. Pursuant to 17 U.S. Code § 105 and standard federal procurement data clauses, the core instructional content is disseminated via official federal repositories as an uncopyrighted public resource inside the United States.
>
> 3. NO INSTITUTIONAL ENDORSEMENT
> The utilization of these public assets does not imply, suggest, or constitute an endorsement, approval, or affiliation by the University of Arizona, the US Army John F. Kennedy Special Warfare Center and School, or the United States Department of Defense.

**Evidence kept alongside the determination:**
- The source documents' metadata names "Anthony Inc.", "U of A South" and
  "Arizona State University". These are consistent with the university and
  contractor partners the disclaimer names.
- No file carries a copyright, distribution or public-release notice.
- The course has been distributed openly for about two decades (the FSI
  Language Courses archive, Live Lingua, yojik.eu mirrors) with no notice
  or challenge.
- Note for a future reader: 17 U.S.C. § 105 covers works of federal
  employees. Contractor-made work is ordinarily covered by the government's
  licence (here, Unlimited Rights) rather than placed in the public domain.
  The owner's determination rests on both grounds together with the
  distribution history above. It is recorded here as the owner's decision,
  not as independent legal verification.

The earlier "DLI" attribution of SOLT was wrong: it came only from folder
names. The app and the exports now credit the US Army JFK Special Warfare
Center and School with the University of Arizona.
