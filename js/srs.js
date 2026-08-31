// SM-2 spaced repetition — localStorage backend
// Key: "soisanuk_progress" → JSON object of card records

const SRS_KEY = "soisanuk_progress";

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(SRS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveProgress(p) {
  localStorage.setItem(SRS_KEY, JSON.stringify(p));
}

function defaultCard() {
  return { interval: 1, repetitions: 0, easeFactor: 2.5, due: 0, totalReviews: 0, correctStreak: 0 };
}

function getCard(p, key) {
  if (!p[key]) p[key] = defaultCard();
  return p[key];
}

// Read a card for display without inserting a record into the store
function peekCard(p, key) {
  return p[key] || defaultCard();
}

// Bounds on SM-2's two compounding values. The ease factor already had a
// floor (1.3, the standard) but no ceiling, and it rises +0.1 on every perfect
// answer without limit — so a card you always ace multiplies its interval by an
// ever-larger factor. 40 consecutive "Perfect" reviews reached ease 6.50 and an
// interval of 1.9e25 days: the card leaves the deck for longer than the age of
// the universe, which is not a schedule, it is a leak.
//
// Not reachable in ordinary use — a realistic 1-lapse-in-7 pattern settles
// around 10 days — but nothing stopped it, and a genuinely well-known card in a
// long-lived store is exactly the case that gets there. SM_MAX_INTERVAL matches
// Anki's default ceiling; SM_MAX_EASE is the same distance above the default
// 2.5 as the 1.3 floor is below it.
const SM_MAX_INTERVAL = 36500;   // days — a century
const SM_MAX_EASE = 3.7;

// quality: 0=blackout 1=wrong 2=hard 3=ok 4=good 5=perfect
function reviewCard(card, quality) {
  const now = Date.now() / 1000;
  card.totalReviews++;
  if (quality >= 3) {
    if (card.repetitions === 0) card.interval = 1;
    else if (card.repetitions === 1) card.interval = 6;
    else card.interval = Math.min(SM_MAX_INTERVAL, Math.round(card.interval * card.easeFactor));
    card.repetitions++;
    card.correctStreak++;
  } else {
    card.repetitions = 0;
    card.interval = 1;
    card.correctStreak = 0;
  }
  card.easeFactor = Math.min(SM_MAX_EASE, Math.max(1.3,
    card.easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  card.due = now + card.interval * 86400;
}

// Only cards that have actually been reviewed can be due; unseen keys are
// the domain of newCards(). Must not create records (read-only query).
function dueCards(p, keys) {
  const now = Date.now() / 1000;
  return keys.filter(k => p[k] && p[k].due <= now);
}

// "New" = never reviewed, OR just lapsed (a wrong answer resets repetitions
// to 0 — see reviewCard). The second case is intentional, not an oversight:
// a card someone just got wrong is exactly the one worth resurfacing sooner
// than its nominal 1-day `due` date, the same way Anki's short-term
// relearning queue works. The tradeoff is that a "union" deck (buildDeck in
// sessions.js) can pull a just-lapsed card back in the very same session,
// ahead of its schedule — accepted, since reinforcing a fresh mistake beats
// strict adherence to the interval.
function newCards(p, keys, limit = 10) {
  return keys.filter(k => !p[k] || p[k].repetitions === 0).slice(0, limit);
}

// Re-insert a lapsed card a few positions ahead so it is relearned within
// the same session. Returns the index it was inserted at.
function requeue(deck, idx, key, gap = 4) {
  const at = Math.min(idx + gap, deck.length);
  deck.splice(at, 0, key);
  return at;
}

// ── The key registry ────────────────────────────────────────────────────────
// One progress store holds three kinds of card, told apart only by key prefix:
// bare Thai word = vocabulary, "sc:"/"sv:" = script glyphs, "sent:" = example
// sentences. Nothing named the whole set, so every counter hand-rolled its own
// idea of what exists — `WORDS.map(w => w[0])` appears in four files, the
// script pair in two more — while dueForecast filtered by nothing at all and
// counted all three. That is how the home screen came to read "0 due now"
// directly above a forecast bar reading "30 now": not one bug, but the absence
// of a single definition to be consistent with. Add a card type here and every
// caller picks it up.
//
// `d` injects the data tables for tests; in the app they are globals from
// data.js and examples.js, which load either side of this file.
function srsKeySets(d) {
  const words = (d && d.words) || (typeof WORDS !== "undefined" ? WORDS : []);
  const cons = (d && d.consonants) || (typeof CONSONANTS !== "undefined" ? CONSONANTS : []);
  const vowels = (d && d.vowels) || (typeof VOWELS !== "undefined" ? VOWELS : []);
  const ex = (d && d.examples) || (typeof EXAMPLES !== "undefined" ? EXAMPLES : null);
  return {
    vocab: words.map(w => w[0]),
    script: [...cons.map(c => `sc:${c[0]}`), ...vowels.map(v => `sv:${v[0]}`)],
    sentence: ex ? words.filter(w => ex[w[0]]).map(w => `sent:${w[0]}`) : [],
  };
}

// Every key the app can actually serve, in one list.
function allSrsKeys(d) {
  const s = srsKeySets(d);
  return [...s.vocab, ...s.script, ...s.sentence];
}

// Upcoming review load: counts per day for the next `days` days.
// Index 0 = due now (incl. overdue), index n = due in n days.
// `keys` bounds it to servable cards, exactly as srsStats does — pass the same
// list to both or the two disagree on screen.
function dueForecast(p, days = 7, keys = null) {
  const now = Date.now() / 1000;
  const buckets = new Array(days + 1).fill(0);
  const cards = keys ? keys.filter(k => p[k]).map(k => p[k]) : Object.values(p);
  for (const c of cards) {
    const day = c.due <= now ? 0 : Math.ceil((c.due - now) / 86400);
    if (day <= days) buckets[day]++;
  }
  return buckets;
}

// `keys` limits the count to cards the app can actually serve. Without it,
// records for words that have since left data.js are counted forever: a store
// with 40 stale keys showed "due: 100" while dueCards() — which filters by live
// keys — could only ever serve 60, so the learner cleared everything reachable
// and the counter still read 40 due, with no way to move it. srsStats and
// dueCards must agree about what exists. Found by the 2026-08-30 lapsed round.
function srsStats(p, keys) {
  const now = Date.now() / 1000;
  const cards = keys ? keys.filter(k => p[k]).map(k => p[k]) : Object.values(p);
  return {
    totalSeen: cards.length,
    dueNow: cards.filter(c => c.due <= now).length,
    mature: cards.filter(c => c.interval >= 21).length,
  };
}
