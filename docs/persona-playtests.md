# Persona playtests

A method for finding defects that no automated check in this repo can find on
its own: unit tests verify functions do what the test author expected; `node
tools/sweep.mjs` verifies every screen loads without erroring, clipping, or
tiny tap targets. Neither can tell you whether a lesson actually teaches
well, whether the SRS pacing feels fair to a real learner, or whether a
translated gloss reads naturally to a fluent speaker. That's a judgment call,
and the way to get it without waiting on a human tester is to hand the
judgment to a fresh agent that plays the app **in character**, with a stated
goal, and reports back.

This was developed and proven on a sibling project (The Last Baht Bus — same
household, same vendored files) over several rounds in August 2026: a
geography-obsessed persona caught four separate places the code silently
stopped tracking a map feature the moment it was refactored; a completionist
persona caught a photo-drip mechanic that permanently skipped content on a
lump-sum payment; a native-German-speaker persona judged translation quality
in a way no catalog-matching test ever could. Every one of those found
something specific, verifiable, and fixable — not vague "this feels off"
notes.

## Why this and not just more unit tests

A unit test can only fail the way its author imagined it could. A persona
with a drive explores the way a real, motivated user explores — which finds
the failure modes nobody wrote a test for because nobody thought of them.
The trade is real: persona output needs verification (agents overclaim and
occasionally hallucinate a repro that doesn't actually reproduce — treat
every finding as a claim, not a fact, until you've run it yourself). The
payoff is that the failure modes it finds are the ones that matter to an
actual learner, not the ones easiest to assert in a test file.

## The method

1. **Write a persona with a drive**, not a task list. "Test the SRS system"
   produces generic coverage. "You are a crammer who wants to see every due
   card RIGHT NOW and gets irrationally annoyed at anything that makes you
   wait" produces someone who will actually find the edge of the scheduling
   algorithm's patience. Give the persona a specific temperament and a
   specific thing they care about — that's what makes their exploration
   different from a checklist.

2. **Brief it as a fully self-contained prompt.** The agent has no memory of
   this conversation and no context beyond what you write. Include: who
   they are, what they're allowed to read/do, what tools exist and how to
   use them, what to hunt for (with enough specificity that they know a real
   finding from a shrug), what NOT to do (don't re-tread ground another
   round already covered; don't fix anything, only report), and the exact
   shape of the report you want back.

3. **Run it as a background agent**, so it can play for a long time — real
   turn-by-turn exploration, not five parallel guesses — without blocking
   the rest of your session. Read its report when it lands.

4. **Verify every concrete claim before acting on it.** Reproduce it
   yourself with the same tool the persona used. This catches both false
   positives (the persona misread something, or a defect it described
   doesn't actually reproduce — this happened at least once on the sibling
   project: a reported "photo mechanic falls through to a generic handler"
   turned out to be a deliberate, correctly-firing joke scene once actually
   tested) and gives you the exact repro you need to fix the real ones
   correctly.

5. **Fix, then pin.** For each verified finding, fix the underlying bug and
   add a regression test that would have caught it, with a comment naming
   what persona/round found it and why. This is what turns a one-off
   playtest into a permanent improvement to the test suite rather than a
   report that ages out of relevance.

6. **Discard what doesn't hold up, explicitly.** Don't silently drop a
   finding that turned out to be a false positive or a deliberate design
   choice — say so, and why, in the same place you'd otherwise add a test.
   Future rounds (and future you) need to know a thing was already checked
   and ruled out, or it gets "found" again every few months.

## The prompt skeleton

```
You are playtesting <app> as <specific persona: temperament + what they
care about>.

## Essential context
<what's just changed / what state the app is in / what NOT to re-litigate
because another round already covered it>

## Your tools
<exactly what's available — see "Driving the app" below for this repo's
two real options, and be explicit about which one this persona should use>

## What to hunt for
<a numbered list of specific defect shapes, not "find bugs" — the more
concretely you describe the class of thing that would count as a finding,
the less time is wasted on vague or redundant reports>

## What NOT to do
<don't fix anything; don't re-cover ground another round already owns;
don't assume every gap is a bug — some are deliberate, and the persona
should say so rather than flag it>

## Deliverable
<the report shape: ranked findings, each with the exact repro; a clear
split between "verified/reproduced" and "design observation, not a bug";
real coverage numbers at the end (how much was actually checked, not
"spot-checked a few") — see the doctrine below>
```

## No silent caps — coverage numbers are part of the report

A persona report that says "I checked the SRS system" is close to useless.
One that says "I ran 40 review sessions across 6 simulated days, covering
both under-review and over-review states, and read all 12 lesson types in
the Guided Course" tells you exactly how much of the surface is actually
vouched for and how much isn't. Always ask for real numbers at the end of a
report, and treat a persona's own claimed coverage the same way you'd treat
any other claim in the report: verify it's plausible, don't just take it.

## Driving the app: this repo's two real options

Unlike a pure-logic engine you can drive with headless JS, most of this
app's actual behavior lives behind DOM interaction — clicking through the
Guided Course, answering an SRS review, running the tokeniser on pasted
text. There are two levels a persona can operate at, and picking the wrong
one for the question you're asking wastes the round:

- **Pure-logic / vm-loaded**, no browser. Anything DOM-free at load
  (`srs.js`, `curriculum.js`'s grading, `segment.js`, `tokeniser.js`,
  `thai-script.js`, the tone engine) can be loaded with `node --test`'s own
  `node:vm` pattern (see any `tests/js/*.test.js` for the loader) and driven
  directly — call `courseGrade`, `_unitQueue`, `segmentThai`, whatever's
  relevant, and inspect the result. This is the right level for questions
  about **correctness of an algorithm or a piece of data** (is this SM-2
  interval right, is this segmentation boundary right, is this romanisation
  right) — fast, no browser needed, and the existing test suite's loader
  code is a working example to copy.

- **Real browser via Playwright**, for anything that's actually about the
  **experience** — does a lesson flow make sense, does the SRS review UI
  feel fair under real interaction, does a translated string actually read
  naturally in context. `tools/sweep.mjs` is the existing precedent:
  headless Chromium via Playwright, `page.goto("file://…")`,
  `page.evaluate()` to click into the DOM and read state back out. Note it
  currently borrows `@playwright/test` from the sibling LBB repo's
  `node_modules` via `createRequire` rather than carrying its own
  dependency — fine for one script, worth reconsidering (a real
  `devDependency` here) if personas become a regular practice, so this repo
  doesn't have an undeclared cross-repo dependency for something that runs
  on every persona round.

Most useful persona rounds will need the browser level, since the
interesting judgment calls (pedagogical pacing, translation naturalness, UI
friction) live in the experience, not in an isolated function. Reserve the
pure-logic level for personas whose whole point IS a specific algorithm's
correctness (a "does the SRS scheduler actually respect the SM-2 spec under
adversarial review timing" persona doesn't need a browser at all).

## Starter persona ideas for this app

Concrete enough to brief directly, not exhaustive:

- **The crammer.** Wants every due card reviewed immediately, gets
  frustrated by anything that makes them wait, tries to game the streak
  system. Tests whether the SRS pacing and the engagement layer (🔥 streak,
  🏁 speedometer, Records) actually cooperate or fight each other.

- **The lapsed learner.** Disappears for three simulated weeks, comes back
  to a pile of overdue reviews. Does the app treat this kindly (graceful
  re-onboarding, sane review batching) or does it dump the whole backlog
  with no mercy — same shape of finding as LBB's inbox-cap bug, where a
  long-absent player's messages/photos got silently deleted instead of
  gracefully caught up.

- **The script-only purist.** Refuses to touch vocab or the Guided Course,
  only wants the Thai script/tone drills. Tests whether that's actually a
  coherent standalone path or whether the app quietly assumes you're doing
  the full curriculum.

- **A fluent Thai reader judging the glosses.** The direct analogue of the
  German round on LBB — someone who can actually read the romanisation
  scheme and the derived Wiktionary glosses and judge whether they're
  correct and natural, not just present. `docs/architecture.md` already
  documents real, measured gaps in the derived-gloss pipeline (88.5% exact
  match, tone-conflict-dropped forms) — a native judgment pass on the
  *surviving* 99.4% is exactly the kind of check nothing else in this repo
  can do.

- **The completionist.** Chases 100% mastery everywhere — every Guided
  Course unit at 80%+ first-try, every Reader level cleared, the longest
  possible streak, Placement pushed to its ceiling. Hunts for the same
  class of thing the LBB Collector found: something that looks trackable
  but silently caps, resets wrong, or can't actually reach 100% no matter
  what you do.

- **A one-thumb mobile learner**, phone in one hand on a commute. Different
  question from `sweep.mjs`'s structural tap-target check — this persona is
  judging whether the *flow* works one-handed under real interaction
  (typed-Thai practice, timed speed reads), not just whether buttons are
  big enough.

## What NOT to expect from this

Persona rounds are expensive (real tokens, real agent time) and produce
prose, not proofs. They're a complement to the existing test suite and
`sweep.mjs`, not a replacement — keep using both. And a persona's report is
a set of claims until you've verified them yourself; budget time for that
step, it's not optional.


## What the first two rounds actually produced (2026-08-30)

Recorded because the method's value is an empirical claim, and because two of
its steps earned their keep in ways worth being concrete about.

**Round 1 — a fluent Thai reader judging the gloss/romanisation data.**
Pure-logic level, no browser. Read 751 of 7,764 dictionary entries line by line
(9.7%) plus eight programmatic scans over 100% of the file. Found 23 curriculum
romanisations that contradict the app's own tone engine, a tone drill that could
mark a correct answer *wrong*, 35 words painted a tone colour contradicting
their own first syllable, and six classes of text damage in the generated
glosses. All fixed.

**Round 2 — a six-months-in learner driving Paste Text.** Browser level,
headless Chromium, desktop + iPhone 13, ~45 distinct texts and a 300k-character
worst case. Found loanwords shredding into real words with confident glosses
(เซเว่น → เซ "to stagger"), a 🎨 toggle that silently replaced the analysis, a
race that resurrected cleared text, a word card that floated over the main menu,
tokens unreachable by keyboard, and a 4.5-second freeze on every screen entry.
All fixed.

**Step 4 (verify before acting) changed the answer twice.**

- Round 2 reported 23 lexicon compounds splitting into their own parts, with an
  obvious fix: add a per-token cost to the segmenter. The 30-sentence gold set
  said the fix was free — boundary-F1 flat at 95.0 across every penalty. Scored
  instead against 940 real sentences it altered 7 and only 4 were right, and one
  of the failures was the very word the fix was for (`ที่อยู่` merged in a
  sentence where it means "who lives at", not "address"). Rejected and recorded
  — see `docs/chrome-extension-handoff.md` §9.
- Round 1's tone-mark disagreements were assumed to be Wiktionary's errors.
  Checking each against the tone engine showed 23 of them were **ours**.

The lesson generalises: **ask a round for the finding, never for the fix.** Every
round has been right about what was wrong and at least once wrong about what to
do about it. Round 3 reported the tone unit as unpassable "verified in headless
Chromium, which has no Thai voice"; the arithmetic was real and the fix stands,
but headless Chromium on this machine *does* expose a th-TH voice — what it had
actually observed was a bug in its own driver. The finding survived
verification; its stated evidence did not.

**Round 3 — a first-time learner, Guided Course.** Ran on the harness. Found
that typing the exact gloss the app had just shown you was marked wrong (372 of
950 words), that all eight chunk units demanded a flawless run because 80% of a
4-card sample is 4/4, and that the tone unit was gated on cards you can only
answer by ear with no TTS check anywhere in learn.js. All fixed.

**Round 4 — a learner returning after a gap.** Fabricated 14 histories, 20-950
cards, gaps of 1-183 days. Found the streak lying identically at every gap
length ("🔥 12 days · today 41 cards" six months later), that reviewing the
backlog earned no streak credit at all, and a due counter that could never be
cleared because srsStats counted dead keys dueCards would never serve. All
fixed.

**Round 5 — a completionist.** Its first finding was that round 4's streak fix,
landed an hour earlier, was **half done** — wired into one of three surfaces, so
the desktop menu showed "streak ended" and "23 day streak" 40px apart. Also
found the unit score badge storing the last attempt rather than the best, and
three bugs in the harness itself including one that silently mis-scored the
entire tone unit.

## What six fable-model rounds produced (2026-09-05)

Recorded for the same reason as the first two, and because one of them found
the worst defect this repo has had.

**Priya — a skimmer who does not read explanatory text.** Drove 189 cards
across five units, dismissing every teaching card on sight. Passed every unit
at 81% without reading a single script note, which was the point of hiring her.
Found that only one card kind in a letters unit can even notice you skipped a
note, and it fires on a coin flip; that nothing anywhere tests a note's content;
that a note anchored on ตลาด sat in a unit that never shows ตลาด; and a CSS
rule that had never applied — `.learn-intro-text{text-align:left}` losing to
`.card-prompt{text-align:center}` on equal specificity, so every long teaching
paragraph in the course had always been centred.

**Dave — a sign-reader who wants to decode shopfronts.** Drove all 19 units,
the reader, Paste Text and the pure functions. Found the letter ladder
**eighteen letters short of its own vocabulary**: 43 glyphs taught against 61
used, so 188 words (19%) could never become decodable and a learner who
finished the entire course still could not read เบียร์ or โรงแรม. Also 174
words decomposing across a syllable boundary, `vowelDisp` being a no-op on the
one call that needed it, and 69 example translations with word-initial g
corrupted to k ("not kood at all", "the karden died").

**Margaret — a retired proofreader learning the alphabet completely.** Took the
six Script screens, none of which any round had opened. Found the tone chart
**playing the wrong tone for two of the five tones** — the high row showed a
non-word and spoke สาม (rising), the rising row spoke ห้า (falling) — the
letter tooltip identifying ั as "◌ัว, ua vowel" and ะ as "เ◌าะ, short o", ท
missing from `TONE_CLASSES`, and เ◌าะ ranked the second commonest vowel in Thai
because compounds inherited their commonest character's frequency.

**Tom — a beginner with four days before he flies.** Found that **the course
was unpassable**. A letters unit teaches eight words and then drew its speed
reads, match round, typing targets and listening from every decodable word —
185 by rung 3, 606 by rung 5 — so 50–63% of graded cards asked the meaning of a
word no unit ever shows, against an 80% pass gate on strictly-gated units. His
simulation: 17% at unit 1, 0–3% after. Fixed, and re-measured at 94–98%.

**Ploy-Anne — fluent by ear, never schooled in the script.** Found การันต์
never raising a sentence's grade (`isLetter` ended one codepoint short of
U+0E4C), so 55 sentences carrying a silent letter sat two levels below the rung
that teaches it; the days of the week glossed as Hindu deities (จันทร์ =
"Candra, the moon god"); the tone colour contradicting the card on the two
words the tests already exempt; and the generator bug behind a correction made
the previous day — the ◌อ length rule matches consonant + อ + consonant, and a
tone mark sits between them.

**Marcus — an engineer who uninstalls anything that gets in his way.** Drove
the real unpacked extension over 17 hostile fixtures. Found Escape leaking into
the host page (closing the site's own modal), `transform` on body blacking out
the card entirely, `mousedown` destroying the page's selection, unasked audio
that cancelled the page's own speech, and the licence credit naming Wiktionary
over Volubilis glosses and over the project's own.

### The lesson these six paid for: a driver cannot fail to know something

Tom's finding is the one to remember. A course that a real learner could not
pass beyond unit 1 sat there while **590 tests passed, the screen sweep was
clean, and four previous persona rounds completed those same units easily.**

Every automated route through the app reads the answer out of the queue item —
`item.word` is right there, and `driveLessonStep` uses it. A harness therefore
cannot experience not knowing a word, which is precisely the experience the
unit was failing to provide for. The teach-first test that existed inspected
cards tagged `"new"`, which were the eight words that were already fine.

So: when the thing under test is whether a learner can DO something, no amount
of driving proves it. Ask for the moment comprehension fails, and brief the
persona to report that moment rather than a defect list.

### Two ways a check can be worse than no check

Both found on the same day, both in this repo's own tests.

- **A check can pin the bug.** `spike/ext-check.mjs` asserted the card credits
  "Wiktionary, CC BY-SA 3.0" unconditionally. It passed for as long as the card
  said that over Volubilis glosses under a different licence. A check written
  from the implementation rather than the requirement locks in whatever the
  implementation did.
- **A check can pass for the wrong reason.** The rewrite of that check called
  `glossSource()` inside `page.evaluate` — which runs in the page's main world,
  where a content script's functions do not exist. Every word came back
  source-less, so "no credit needed" was always true and the check was green
  without testing anything. It reads the answer off the DOM now, because that
  is the only thing the two worlds share.

### The second lesson: re-run after fixing, before running a new persona

Round 5 was briefed as a fresh persona and its most valuable finding was a
regression an hour old. A round costs the same whether it explores new ground
or re-treads just-changed ground, and just-changed ground has the higher defect
density — the fixer has fresh assumptions and no distance from them. **Before
launching a new persona, consider pointing the next round at what you just
changed.**

Corollary, learned the same way: a fix that touches a *display* should be
checked at every surface that renders it. `grep` for the accessor, not the
symptom.

## Use the harness — don't write a driver

`tools/playtest-harness.mjs` exists so a round never has to reverse-engineer the
DOM again. Import `openApp()` and call verbs:

```js
import { openApp } from "./tools/playtest-harness.mjs";
const app = await openApp({ mobile: true });
await app.startCourse();
await app.startUnit(0);
const log = await app.runUnit({ steps: 60, accuracy: 0.8 });  // 0.8 = miss ~1 in 5
await app.pasteText("ผมอยู่หน้าเซเว่น");
console.log(app.report());
await app.close();
```

`driveLessonStep()` asks the app what step it is on (`_lu.queue[_lu.at].kind`)
and dispatches — it does not hunt for a button. Every verb catches its own
failures, screenshots to `shots/playtest/`, and keeps going, so a round always
ends with a report rather than a stack trace.

**This was written because the first attempt at a Guided Course round died on
exactly that.** The flow emits nine step shapes in one letters unit, and the
three things that cost that attempt its whole session are now handled and worth
knowing anyway:

- **Answer steps have no next-button.** You advance an MC card by picking an
  option. A generic "Got it / Next" hunt finds nothing and looks like a hang.
- **Which half of the word is the answer varies.** `mc`/`speed` want the
  English; `mcth`/`clozex` and Thai-mode `listen` want the Thai. Click the wrong
  half and the card sits there forever.
- **The advance is on a timer, not a click.** `setTimeout(_learnNext, 550)` on a
  correct answer, `900` on a miss. Poll for the index to change; do not guess a
  duration. The failed attempt bumped its timeouts 60→220 across three re-runs
  without ever discovering 550 was the number.

Also: the screen id is `lesson-screen`, not `learn-screen`; a missed answer
shows both a "🔍 word card" button and a "Next →" button, and clicking the
first goes nowhere; and the 5-pair match card pairs by index with the English
chip cut at `" — "` then `"/"`, so clicking tiles blindly never completes it.


## Verify the tests, not just the findings

Step 5 says "fix, then pin". A pin that cannot fail is not a pin. Several
findings from these rounds are in DOM-bound code that cannot run under
`node --test`, so their regression tests assert the SHAPE OF THE SOURCE — that
`_gResize` multiplies by `devicePixelRatio`, that the clock HUD wraps its
counter in a span. Those are legitimate when behaviour is unreachable, and they
are also easy to write badly.

**Mutation-test every source-shape assertion**: reintroduce the original bug,
run the test, confirm it fails. Doing this across the game round's four new
tests found one that did not. It asserted `_gResize` *mentioned*
`devicePixelRatio`; a mutation that kept `const dpr = …` and dropped `* dpr`
from the assignment passed clean, so the test would have let the primary bug
back in. Two of the other three mutations were caught, and the fourth was
caught only because it removed the string the test named.

Rule of thumb: assert the operation, not the vocabulary. `/\*\s*dpr/` catches
what `/devicePixelRatio/` does not.
