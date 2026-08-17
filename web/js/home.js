// The desktop home pane.
//
// On desktop the sidebar is the navigation, so the main pane had nothing to
// do: measured at 1440x900 it was a 936x900 area with 6.8% of it covered —
// a decorative wordmark, a duplicate of the sidebar's own stats line, and an
// arrow pointing back at the sidebar. This fills it with what the app
// already knows: the one action worth taking next, the numbers behind it,
// and a few words to poke at.
//
// Everything here READS existing state (srs.js, learn.js) — nothing new is
// persisted and no schedule is touched by looking at this screen. Mobile
// never renders it: there the menu screen carries the full nav list, and
// #menu-welcome stays display:none.
//
// DOM-free at load (vm-testable); every document reference is inside a
// function, and the pure helpers below are covered by tests/js/home.test.js.

// How many words the "a few words" strip shows, and how many days of
// forecast to draw. Both are display choices, not data limits.
const HOME_WORDS = 8;
const HOME_FORECAST_DAYS = 7;

// The headline for whatever ▶ Continue is about to do. Takes the plan so the
// card and the button can never disagree (see continuePlan in learn.js).
function homeCta(plan, streak) {
  if (!plan) return { title: "Start today", sub: "your first lesson is waiting" };
  if (plan.kind === "review") {
    const n = plan.due.length;
    return { title: `${n} review${n === 1 ? "" : "s"} ready`,
             sub: streak && streak.days ? "keep the streak alive" : "warm up on what you already know" };
  }
  if (plan.kind === "unit") {
    return { title: plan.unit.label, sub: "your next lesson" };
  }
  return { title: "Speed round", sub: "all caught up — go fast instead" };
}

// The four numbers worth showing, as [value, label] pairs. Pure so the
// choice of what counts as a "stat" is testable without a DOM.
function homeStats(srs, streak, path, course) {
  const done = (course || []).filter(u => _unitDone(path || {}, u)).length;
  return [
    [srs.dueNow, "due now"],
    [(streak && streak.days) || 0, "day streak"],
    [srs.mature, "mature"],
    [`${done}/${(course || []).length}`, "units"],
  ];
}

// Scale the forecast buckets to bar heights (px). Kept separate because an
// all-zero forecast must not divide by zero — a brand-new learner sees a
// flat baseline, not a broken chart.
function homeForecastBars(buckets, maxPx = 34) {
  const peak = Math.max(...buckets, 0);
  return buckets.map(n => ({ n, px: peak > 0 ? Math.max(Math.round((n / peak) * maxPx), n ? 3 : 1) : 1 }));
}

// A few words to browse. Prefers ones you've already met (they mean
// something to you) and tops up with unseen vocabulary so a new learner
// still sees a full strip rather than an empty one.
function homeWordPicks(words, progress, n = HOME_WORDS, rand = Math.random) {
  const shuffled = arr => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const seen = shuffled(words.filter(w => progress[w[0]] && progress[w[0]].repetitions > 0));
  const rest = shuffled(words.filter(w => !(progress[w[0]] && progress[w[0]].repetitions > 0)));
  return [...seen, ...rest].slice(0, n);
}

// ── Rendering ───────────────────────────────────────────────────────────────

function _homeIsDesktop() {
  return typeof matchMedia === "function" &&
    matchMedia("(min-width: 701px) and (min-height: 500px)").matches;
}

function _homeEsc(s) { return _wcEsc(s); }

function _homeRender() {
  const host = document.getElementById("menu-welcome");
  if (!host || !_homeIsDesktop()) return;

  const prog = loadProgress();
  const srs = srsStats(prog);
  const streak = typeof _streakLoad === "function" ? _streakLoad() : {};
  const path = typeof _pathLoad === "function" ? _pathLoad() : {};
  const plan = typeof continuePlan === "function" ? continuePlan() : null;
  const cta = homeCta(plan, streak);
  const stats = homeStats(srs, streak, path, typeof COURSE !== "undefined" ? COURSE : []);
  const bars = homeForecastBars(dueForecast(prog, HOME_FORECAST_DAYS));
  const picks = homeWordPicks(WORDS, prog);
  const level = typeof _levelName === "function"
    ? _levelName((typeof COURSE !== "undefined" ? COURSE : []).filter(u => _unitDone(path, u)).length)
    : "";

  host.innerHTML = `
    <div class="home-hero">
      <div class="home-wordmark" role="button" tabindex="0" title="Tap to hear &amp; decompose">ภาษาไทย</div>
      ${level ? `<div class="home-level">${_homeEsc(level)}</div>` : ""}
    </div>

    <button class="home-cta" id="home-cta">
      <span class="home-cta-play">▶</span>
      <span class="home-cta-text">
        <span class="home-cta-title">${_homeEsc(cta.title)}</span>
        <span class="home-cta-sub">${_homeEsc(cta.sub)}</span>
      </span>
    </button>

    <div class="home-stats">
      ${stats.map(([v, l]) => `
        <div class="home-stat">
          <div class="home-stat-num">${_homeEsc(v)}</div>
          <div class="home-stat-lbl">${_homeEsc(l)}</div>
        </div>`).join("")}
    </div>

    <div class="home-panel">
      <div class="home-panel-hd">Review forecast</div>
      <div class="home-forecast">
        ${bars.map((b, i) => `
          <div class="home-fbar">
            <span class="home-fbar-n">${b.n || ""}</span>
            <div class="home-fbar-fill${i === 0 ? " now" : ""}" style="height:${b.px}px"></div>
            <span class="home-fbar-lbl">${i === 0 ? "now" : "+" + i}</span>
          </div>`).join("")}
      </div>
    </div>

    <div class="home-panel">
      <div class="home-panel-hd">
        A few words
        <button class="home-reshuffle" id="home-reshuffle" title="Show different words" aria-label="Show different words">↻</button>
      </div>
      <div class="home-words" id="home-words">
        ${picks.map(w => `
          <button class="home-word" data-th="${_homeEsc(w[0])}">
            <span class="home-word-th" lang="th">${_homeEsc(w[0])}</span>
            <span class="home-word-en">${_homeEsc(w[2])}</span>
          </button>`).join("")}
      </div>
    </div>`;

  document.getElementById("home-cta").onclick = () => startContinue();
  document.getElementById("home-reshuffle").onclick = _homeRender;
  const mark = host.querySelector(".home-wordmark");
  const openMark = () => openWordModal(WORD_MAP["ภาษาไทย"] || WORDS[0]);
  mark.onclick = openMark;
  mark.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openMark(); } };
  for (const btn of host.querySelectorAll(".home-word")) {
    btn.onclick = () => {
      const w = WORD_MAP[btn.dataset.th];
      if (w) openWordModal(w);
    };
  }
}

// Re-render when the layout crosses the desktop threshold, so resizing a
// window (or rotating a tablet) doesn't leave a stale or blank pane.
function _homeInit() {
  _homeRender();
  if (typeof matchMedia !== "function") return;
  const mq = matchMedia("(min-width: 701px) and (min-height: 500px)");
  const onChange = () => _homeRender();
  if (mq.addEventListener) mq.addEventListener("change", onChange);
  else if (mq.addListener) mq.addListener(onChange);
}
