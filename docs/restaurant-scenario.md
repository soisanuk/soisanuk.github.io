# A restaurant scenario — design proposal

Status: **the ordering beat is built** (`web/js/restaurant.js`, nav `M`) and is at **v1.1** after round 28. The rest of this document is the proposal v1 was built from; the section at the end records what a teacher found wrong with v1 and what changed.

## Round 28 (2026-10-19): a teacher's verdict on v1, and v1.1

Khun Preeya — nineteen years teaching Thai to foreigners, judging drills by what a learner can do at a table afterwards — would not have put v1 in front of a class. Her findings, verified and fixed unless marked:

- **Passable without reading Thai.** Chips sat in a fixed order, the target was English, and the arrival card translated whatever you tapped back into English, so every order taught four position→English facts. Her Thai-blind run scored 4/5 by the second sitting; my simulation of a dumber blind learner still climbed 0.4 → 3.1 over four. **v1.1 shuffles the chips per order**; the same strategy now scores 0.02 at every sitting. Pinned with the simulation in both directions (`round28.test.js`).
- **A miss never showed the right word** — only the wrong one quoted back, and "the table wanted" in English. The learner learned "ทอด was wrong" and guessed among the rest, which is the position strategy above. **v1.1 prints the wanted order in Thai, tappable, with the learner's own particle**, and the shelf carries it too. Sweep-checked in a browser.
- **Half the grid is not a dish.** Targets were drawn uniformly from protein × method, so ไก่นึ่ง, หมูต้ม and bare หมูผัด were rehearsed with TTS and ถูกต้องค่ะ. The doc called the sparsity "the feature"; she called it teaching that any cell of a grid is food. **v1.1 draws targets from 15 orderable dishes** (`_RST_DISHES`); the chips still offer every method, so the other 15 remain reachable as wrong answers. Also corrected: seven in-grid cells are WORDS entries, not eight — หมูปิ้ง's ปิ้ง is not a method chip.
- **The fixed template taught three things wrong.** จาน on soup; spice as a mandatory slot on steamed fish; and ขอไก่ย่างครับ — the order g3 teaches — impossible to place, because all four slots were required. **v1.1: quantity and spice are optional, soup takes ถ้วย (added to the course), a dish that takes no spice has none in its target and stating one is a miss.**
- **ครับ hard-wired for every learner.** **v1.1 adds a particle slot, ครับ or ค่ะ, never graded.**
- **Quantity chips had no English**, so "But you said สาม." left the weakest learner with nothing. **Fixed.**
- **The audio is decoration.** True, and still true: nothing in v1.1 depends on hearing anything. The waitress's question is now spoken, which makes it less silent, not listening practice. **Not fixed; recorded.**
- **It is recognition with a composition step, not production.** Every word is on screen; nothing is retrieved from memory, said, or typed. v1.1 removes the position shortcut, so the recognition is at least honest — the Thai is the only route to the chip — but Owen (reads Thai, freezes producing it) is helped only a little. **Not fixed. The next stage is the one she named: chips face-down, the learner types or says the order.** That is the production beat, and it is where this goes next if v1.1 turns out to be worth continuing.

Her verdict on v1 is worth keeping verbatim in spirit: a drill is judged by what the learner can do afterwards, and after v1 a learner who could not read ไก่ scored four plates in five. After v1.1 that learner scores none — which is the minimum a drill owes its class, not the maximum. The question it answers
is the one that killed the first version of this idea: *how do you gamify
restaurant interactions so they stay interesting?*

## Why not a dialogue tree

The obvious shape is Soi Buakhao with a menu: a scripted beat, four replies, one
correct, a percentage at the end. That is a quiz in a costume, and we already
have one. Three specific problems with it here:

- **It trains recognition, not production.** Round 21's persona (Owen, who reads
  Thai but freezes producing it) found exactly this gap in Sentence SRS. All 75
  of Soi Buakhao's lines are pick-one-of-four.
- **The feedback is a red X.** A wrong answer tells you that you were wrong, not
  what you said instead.
- **The content cost is the whole cost.** Soi Buakhao's 459-line engine was
  never the problem; its *lines* needed a 66-syllable romanisation pass, twelve
  คะ→khá corrections and a rewrite of night three. A dialogue tree's cost scales
  with the number of branches, and buys recognition practice only.

## The mechanic: the kitchen is literal

You compose an order out of parts. The kitchen brings **exactly what you said**.

`ไก่ทอด` and `ไก่ย่าง` are one syllable apart and arrive as different plates.
Ask for `เผ็ดมาก` instead of `เผ็ดน้อย` and you get the dish you ordered, not a
cross in a box. The waiter's line on a mismatch is not "incorrect" — it is
*แต่คุณบอกว่าทอด*, "but you said fried."

That is the whole answer to the interest question. The interest is not in the
score; it is in the consequence being **visible, specific and funny**. The error
names itself.

## Why this works in Thai and would not in Spanish

`GRAMMAR_LESSONS` opens by saying it: no conjugation, no plurals, no articles,
words never change shape. So slot-composition produces *genuinely correct* Thai
rather than a pidgin that has to be forgiven. A compose-the-utterance mechanic
is cheap here for a reason specific to the language.

## The composition grammar

```
ขอ + [dish] + [number] + [classifier] + [modifier] + ครับ/ค่ะ
```

Verified against the current tokeniser — seven of these eight compose cleanly,
token by token, with every token already a `WORDS` entry:

```
ok   ขอข้าวผัดหมูหนึ่งจานเผ็ดน้อยครับ   ขอ|ข้าวผัด|หมู|หนึ่ง|จาน|เผ็ดน้อย|ครับ
ok   ขอไก่ย่างสองจานไม่เผ็ดครับ         ขอ|ไก่ย่าง|สอง|จาน|ไม่เผ็ด|ครับ
ok   ขอปลาทอดหนึ่งจานไม่ใส่ผงชูรสครับ   ขอ|ปลาทอด|หนึ่ง|จาน|ไม่ใส่ผงชูรส|ครับ
ok   ขอต้มยำกุ้งหนึ่งจานเผ็ดมากครับ     ขอ|ต้มยำกุ้ง|หนึ่ง|จาน|เผ็ดมาก|ครับ
ok   ผมแพ้ถั่วครับ                      ผม|แพ้ถั่ว|ครับ
ok   ขอน้ำเปล่าหนึ่งขวดครับ             ขอ|น้ำเปล่า|หนึ่ง|ขวด|ครับ
ok   เก็บเงินด้วยครับ                   เก็บเงิน|ด้วย|ครับ
GAP  ขอหมูปิ้งสองไม้ครับ                missing: ไม้
```

`ไม้`, the classifier for skewers, is the single vocabulary gap — and it is the
classifier for `หมูปิ้ง`, which only went in on 2026-10-08. One word to add.

## The dish grid

The data already holds eight protein × method compounds and **all** the parts:

```
          grilled    fried      stir-fried  boiled   steamed   skewered
pork      หมูย่าง ✓   หมูทอด ✓    ·          ·        ·        หมูปิ้ง ✓
chicken   ไก่ย่าง ✓   ไก่ทอด ✓    ·          ·        ·          ·
fish        ·       ปลาทอด ✓    ·          ·        ·          ·
beef      เนื้อย่าง ✓    ·        ·          ·        ·          ·
prawn       ·         ·        ·          ·        ·          ·
squid    ปลาหมึกย่าง ✓   ·        ·          ·        ·          ·
```

Eight of thirty-six cells exist as dictionary entries. **That sparsity is the
feature**: the game teaches composition rather than memorised compounds, and
`กุ้งผัด` or `ปลานึ่ง` are formed the same way even where no entry exists.

Sketch of the data, deliberately flat and reviewable like `_SB_QS`:

```js
const _RST_PROTEINS = [
  { th: "หมู",      rom: "mǔu",       en: "pork" },
  { th: "ไก่",      rom: "kài",       en: "chicken" },
  { th: "ปลา",      rom: "plaa",      en: "fish" },
  { th: "เนื้อ",     rom: "núea",      en: "beef" },
  { th: "กุ้ง",      rom: "kûng",      en: "prawn" },
  { th: "ปลาหมึก",  rom: "plaa-mùek", en: "squid" },
];
const _RST_METHODS = [
  { th: "ย่าง", rom: "yâang", en: "grilled",     plate: "grilled" },
  { th: "ทอด",  rom: "thôot", en: "fried",       plate: "fried" },
  { th: "ผัด",  rom: "phàt",  en: "stir-fried",  plate: "stirfry" },
  { th: "ต้ม",  rom: "tôm",   en: "boiled",      plate: "soup" },
  { th: "นึ่ง",  rom: "nûeng", en: "steamed",     plate: "steamed" },
];
const _RST_MODIFIERS = [
  { th: "เผ็ดน้อย",       rom: "phèt-nóoi",         en: "a little spicy",  heat: 1 },
  { th: "เผ็ดมาก",       rom: "phèt-mâak",         en: "very spicy",      heat: 3 },
  { th: "ไม่เผ็ด",        rom: "mâi-phèt",          en: "not spicy",       heat: 0 },
  { th: "ไม่ใส่ผงชูรส",   rom: "mâi-sài-phǒng-chuu-rót", en: "no MSG" },
  { th: "หวานน้อย",      rom: "wǎan-nóoi",         en: "less sweet" },
];
```

Every string above is already a `WORDS` entry, so `corpus-agreement` can check
this file the moment it exists — which is the lesson from Soi Buakhao, whose
499 romanised syllables went unguarded for months.

## The mis-delivery logic, which is the heart of it

The kitchen does not grade. It renders. Given the ticket the learner actually
composed, it serves the dish that utterance describes, then compares:

| what differs | what arrives | what the learner learns |
|---|---|---|
| method | the other preparation | ทอด vs ย่าง vs นึ่ง, by sight |
| protein | the other animal | the protein words |
| heat | the heat they asked for | เผ็ดน้อย vs เผ็ดมาก, with stakes |
| quantity | that many plates | numbers and classifiers |
| nothing | the right plate | — |

The waiter's response quotes the learner's own words back. That is the entire
feedback mechanism, and it needs no grading UI.

## The arc comes free from the domain

| beat | mechanic | reuses |
|---|---|---|
| arrival | กี่คนคะ → answer with a number | numbers; `กี่` added 2026-10-14 |
| seating | nothing to get wrong; sets the scene | — |
| ordering | compose protein × method × modifier | the grid above |
| the food | literal rendering of the utterance | — |
| the bill | spoken total — is it right? | `_bbThaiNum` from baht-bus.js |

The bill beat must **sometimes be correct**, or "always claim overcharged" wins.
That is the trick `clock.js` already uses, where the distractor hours are the
*pedagogically* confusable ones rather than random.

## Difficulty by role reversal

- **Diner** (easier): you produce the Thai, one table, no clock.
- **Waiter** (harder): several tables order in Thai, you comprehend and act
  before patience runs out. Same vocabulary, inverted skill, and the natural
  home for time pressure.

Ship Diner first. Waiter is a second mode over the same data.

## Retention: collect the mistakes, not the score

A shelf of wrong plates — the durian nobody ordered, the very spicy dish asked
for by accident. Round 25's persona cared whether Records told the truth about a
long, messy history; a wrong-plate shelf is a trophy case made of errors, which
is honest, funnier than a percentage, and much stickier.

## Relationship to Soi Buakhao

An earlier draft of this proposal said to extract a shared scenario runner from
`soi-buakhao.js` first. **Withdrawn.** That assumed the restaurant would be the
same machine with different content, and it is not: pick-one-of-four and
compose-an-utterance are different mechanics, and one runner over both would be
a false abstraction.

What they can honestly share is a thin **scene harness** — a sequence of beats,
an NPC prompt, a score, a pass gate, a results board — with the *beat type*
plugged in: `choice` for Soi Buakhao, `compose` and `verify-number` for the
restaurant. Two real instances justify that; one would not.

The payoff runs the other way too. Once a `compose` beat exists, giving each
Soi Buakhao night one or two of them upgrades the existing game without
rewriting it, and closes the recognition-only gap round 21 identified.

## Where it hangs off the course

Not off a module. The course is sequenced by **script** — `LETTER_BATCHES` plus
`courseUnitWords(batchIdx)` — so a unit is a rung of letters and the words it
introduces are whichever become decodable at that rung. There is no "restaurant
module" to finish.

Gate it on **category mastery** instead: unlock when the learner has passed some
threshold of the `restaurant` category (103 words, the third largest). Per-word
progress already exists, so the gate is computable today, and it avoids
rewriting the curriculum's spine.

## Risks, honestly

- **Word order needs validating.** Composition means a small grammar, not a
  dialogue tree. Cheap in Thai, but real work, and it is where a half-built
  version will feel broken.
- **Content validation is the true cost**, as always here. Every line wants a
  romanisation, tone and naturalness pass. Round 26 found three of eleven
  brand-new examples did not teach their own word, and they had been written
  carefully.
- **Scope creep via the grid.** Filling all 36 cells is tempting and wrong; the
  eight real compounds plus free composition is the whole lesson.

## Open decisions

1. Diner-only first, or both roles?
2. Is the bill beat in v1, or does the meal end when the food arrives?
3. Add `ไม้` now (one word), or avoid skewers in v1?
4. Build the ordering beat standalone to test whether it is fun, before any
   harness extraction?

Recommended: Diner only, no bill, add `ไม้`, and build the ordering beat alone.
If that one beat is not fun, we have spent one beat finding out.
