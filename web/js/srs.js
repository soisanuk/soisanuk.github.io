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

function dueCards(p, keys) {
  const now = Date.now() / 1000;
  return keys.filter(k => getCard(p, k).due <= now);
}

function newCards(p, keys, limit = 10) {
  return keys.filter(k => !p[k] || p[k].repetitions === 0).slice(0, limit);
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
