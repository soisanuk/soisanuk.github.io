// SM-2 spaced repetition — localStorage backend
// Key: "thaicab_progress" → JSON object of card records

const SRS_KEY = "thaicab_progress";

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

// quality: 0=blackout 1=wrong 2=hard 3=ok 4=good 5=perfect
function reviewCard(card, quality) {
  const now = Date.now() / 1000;
  card.totalReviews++;
  if (quality >= 3) {
    if (card.repetitions === 0) card.interval = 1;
    else if (card.repetitions === 1) card.interval = 6;
    else card.interval = Math.round(card.interval * card.easeFactor);
    card.repetitions++;
    card.correctStreak++;
  } else {
    card.repetitions = 0;
    card.interval = 1;
    card.correctStreak = 0;
  }
  card.easeFactor = Math.max(1.3,
    card.easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  card.due = now + card.interval * 86400;
}

// Only cards that have actually been reviewed can be due; unseen keys are
// the domain of newCards(). Must not create records (read-only query).
function dueCards(p, keys) {
  const now = Date.now() / 1000;
  return keys.filter(k => p[k] && p[k].due <= now);
}

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

// Upcoming review load: counts per day for the next `days` days.
// Index 0 = due now (incl. overdue), index n = due in n days.
function dueForecast(p, days = 7) {
  const now = Date.now() / 1000;
  const buckets = new Array(days + 1).fill(0);
  for (const c of Object.values(p)) {
    const day = c.due <= now ? 0 : Math.ceil((c.due - now) / 86400);
    if (day <= days) buckets[day]++;
  }
  return buckets;
}

function srsStats(p) {
  const now = Date.now() / 1000;
  const cards = Object.values(p);
  return {
    totalSeen: cards.length,
    dueNow: cards.filter(c => c.due <= now).length,
    mature: cards.filter(c => c.interval >= 21).length,
  };
}
