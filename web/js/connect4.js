// Soi 6 — Connect สี่ (Four): Pattaya bar-themed Connect 4 vs a hostess.
// Learn Thai vowels: answer a vowel question to earn your drop — get it
// wrong and the bar picks a random column for you.
// Board logic and AI are DOM-free at load time (unit-tested via node:vm).

// ── Hostesses / difficulty ─────────────────────────────────────────────────

const _C4_GIRLS = [
  {
    name: "Nong", th: "น้อง", e: "🌸", level: 0, aiFirst: false,
    blurb: "Sweet, brand new on the soi — keeps checking her phone mid-game.",
    lines: {
      right: ["เก่งจัง! Smarter than you look na~ 🥰", "ถูกต้อง! Teach me later? 🙈"],
      wrong: ["อุ๊ย ผิดค่ะ~ I pick for you hehe 🙈", "Wrong! But you're cute, so it's okay 🌸"],
      taunt: ["Is this good? I never win anything 😅", "Wait... which way is four again? 🤔"],
      win:   ["ชนะแล้ว!! First win this month!! 🌸🎉", "I WON?! Don't tell Mamasan how 😭"],
      lose:  ["You win~ Mamasan is going to yell at me again 😭", "แพ้อีกแล้ว... buy me a cola to cheer me up? 🥤"],
      draw:  ["A tie! Nobody buys drinks. Mamasan hates ties 😅"],
    },
  },
  {
    name: "Pim", th: "พิม", e: "💋", level: 1, aiFirst: false,
    blurb: "Five years behind this bar. Never once paid for her own drink.",
    lines: {
      right: ["Mmm, brains too? Dangerous combination, tilac 💋", "ถูกค่ะ. Smart men tip better 😏"],
      wrong: ["Wrong, darling. Now the board is mine 😏", "ผิดค่ะ~ Drink less, study more 🍸"],
      taunt: ["I've seen your next move already, sweetheart 💅", "You play like a two-week tourist 😘"],
      win:   ["สี่แล้ว! Four in a row — that's a lady drink you owe me 🍹", "Game, set, drink. Barman! He's paying 💋"],
      lose:  ["โอเค, you win this round... rematch, double or nothing? 🍸", "Lucky. The soi makes everyone lucky once 😏"],
      draw:  ["A draw? How boring. Buy me a drink anyway 🍹"],
    },
  },
  {
    name: "Madam Oy", th: "ออย", e: "😈", level: 2, aiFirst: true,
    blurb: "The Mamasan. Owns the bar, three condos, and every game since 2009.",
    lines: {
      right: ["Correct. Don't get cocky, สุดหล่อ 😈", "ถูกต้อง. Even a stopped clock... 💅"],
      wrong: ["ผิดค่ะ. On my soi, mistakes cost you 💅", "Wrong. The board obeys ME now 😈"],
      taunt: ["I ran this trap before you could read, ที่รัก 👑", "Cute move. I allowed it 😈", "The house always wins, darling 🖤"],
      win:   ["Game over, ที่รัก. Kiss your baht goodbye 👑", "Four. Again. Tell your friends who owns Soi 6 😈"],
      lose:  ["...Nobody beats me on Soi 6. Enjoy it — it won't happen twice 🖤", "Hm. I let you win. Obviously 👑"],
      draw:  ["A stalemate. You live... this time 🖤"],
    },
  },
];

// ── Pure board logic (7 cols × 6 rows; 0 empty, 1 player, 2 hostess) ──────

const _C4_COLS = 7, _C4_ROWS = 6;

function _c4NewBoard() {
  return Array.from({ length: _C4_ROWS }, () => new Array(_C4_COLS).fill(0));
}

function _c4DropRow(board, col) {
  for (let r = _C4_ROWS - 1; r >= 0; r--) if (board[r][col] === 0) return r;
  return -1;
}

function _c4ValidCols(board) {
  const out = [];
  for (let c = 0; c < _C4_COLS; c++) if (board[0][c] === 0) out.push(c);
  return out;
}

// Returns { p, cells } for a connect-4, or null.
function _c4Winner(board) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < _C4_ROWS; r++) {
    for (let c = 0; c < _C4_COLS; c++) {
      const p = board[r][c];
      if (!p) continue;
      for (const [dr, dc] of dirs) {
        const cells = [[r, c]];
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k, nc = c + dc * k;
          if (nr < 0 || nr >= _C4_ROWS || nc < 0 || nc >= _C4_COLS) break;
          if (board[nr][nc] !== p) break;
          cells.push([nr, nc]);
        }
        if (cells.length === 4) return { p, cells };
      }
    }
  }
  return null;
}

function _c4Full(board) {
  return _c4ValidCols(board).length === 0;
}

// Column that gives p an immediate win, or -1.
function _c4ImmediateWin(board, p) {
  for (const c of _c4ValidCols(board)) {
    const r = _c4DropRow(board, c);
    board[r][c] = p;
    const won = _c4Winner(board);
    board[r][c] = 0;
    if (won) return c;
  }
  return -1;
}

// Heuristic eval from p's perspective: score all 4-windows + centre bonus.
function _c4Eval(board, p) {
  const q = p === 1 ? 2 : 1;
  let score = 0;
  const scoreWin = (win) => {
    const mine = win.filter(v => v === p).length;
    const theirs = win.filter(v => v === q).length;
    if (mine && theirs) return 0;
    if (mine === 3) return 50;
    if (mine === 2) return 8;
    if (theirs === 3) return -60;
    if (theirs === 2) return -8;
    return 0;
  };
  for (let r = 0; r < _C4_ROWS; r++)
    for (let c = 0; c < _C4_COLS; c++) {
      if (c + 3 < _C4_COLS) score += scoreWin([board[r][c], board[r][c+1], board[r][c+2], board[r][c+3]]);
      if (r + 3 < _C4_ROWS) score += scoreWin([board[r][c], board[r+1][c], board[r+2][c], board[r+3][c]]);
      if (c + 3 < _C4_COLS && r + 3 < _C4_ROWS)
        score += scoreWin([board[r][c], board[r+1][c+1], board[r+2][c+2], board[r+3][c+3]]);
      if (c - 3 >= 0 && r + 3 < _C4_ROWS)
        score += scoreWin([board[r][c], board[r+1][c-1], board[r+2][c-2], board[r+3][c-3]]);
    }
  for (let r = 0; r < _C4_ROWS; r++) if (board[r][3] === p) score += 3;
  return score;
}

function _c4Negamax(board, depth, alpha, beta, p) {
  const won = _c4Winner(board);
  if (won) return won.p === p ? 100000 + depth : -100000 - depth;
  if (depth === 0 || _c4Full(board)) return _c4Eval(board, p);
  let best = -Infinity;
  // centre-out ordering helps pruning
  for (const c of [3, 2, 4, 1, 5, 0, 6]) {
    const r = _c4DropRow(board, c);
    if (r < 0) continue;
    board[r][c] = p;
    const v = -_c4Negamax(board, depth - 1, -beta, -alpha, p === 1 ? 2 : 1);
    board[r][c] = 0;
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function _c4BestMove(board, p, depth) {
  let bestCol = -1, bestVal = -Infinity;
  for (const c of [3, 2, 4, 1, 5, 0, 6]) {
    const r = _c4DropRow(board, c);
    if (r < 0) continue;
    board[r][c] = p;
    const v = -_c4Negamax(board, depth - 1, -Infinity, Infinity, p === 1 ? 2 : 1);
    board[r][c] = 0;
    if (v > bestVal) { bestVal = v; bestCol = c; }
  }
  return bestCol;
}

// AI move for difficulty level 0/1/2 (hostess is player 2).
function _c4AiMove(board, level) {
  const valid = _c4ValidCols(board);
  const centreish = valid.slice().sort((a, b) => Math.abs(3 - a) - Math.abs(3 - b));
  if (level === 0) {
    // Nong: distracted — sometimes takes a win, rarely blocks
    const win = _c4ImmediateWin(board, 2);
    if (win !== -1 && Math.random() < 0.35) return win;
    const block = _c4ImmediateWin(board, 1);
    if (block !== -1 && Math.random() < 0.25) return block;
    return valid[Math.floor(Math.random() * valid.length)];
  }
  if (level === 1) {
    // Pim: takes wins, blocks yours, likes the middle
    const win = _c4ImmediateWin(board, 2);
    if (win !== -1) return win;
    const block = _c4ImmediateWin(board, 1);
    if (block !== -1) return block;
    return Math.random() < 0.7 ? centreish[0] : valid[Math.floor(Math.random() * valid.length)];
  }
  // Madam Oy: negamax lookahead
  return _c4BestMove(board, 2, 5);
}

// ── Vowel quiz (uses VOWELS from data.js) ──────────────────────────────────

function _c4MakeQuiz() {
  const pool = VOWELS;
  const answer = pool[Math.floor(Math.random() * pool.length)];
  // Exclude entries sharing the answer's romanisation (e.g. the two "ai"s,
  // the two "oo"s) so only one choice can be right.
  const others = pool.filter(v => v !== answer && v[1] !== answer[1]);
  const distractors = others.sort(() => Math.random() - 0.5).slice(0, 3);
  const choices = [answer, ...distractors].sort(() => Math.random() - 0.5);
  return { answer, choices };
}

// ── State ──────────────────────────────────────────────────────────────────

let _c4Girl    = null;
let _c4Board   = null;
let _c4Phase   = "pick";   // pick | quiz | drop | ai | end
let _c4Quiz    = null;
let _c4Replays = 0;        // replay-button presses for the current quiz
let _c4LastDrop = null;    // {r, c} of the newest token, for the fall animation
let _c4Wins    = 0;
let _c4Losses  = 0;
let _c4Tab     = 0;        // lady-drink tab in baht
let _c4TimerId = null;

// ── DOM helpers ────────────────────────────────────────────────────────────

function _c4Esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function _c4Active() {
  return document.getElementById("c4-screen").classList.contains("active");
}

function _c4Later(ms, fn) {
  if (_c4TimerId) clearTimeout(_c4TimerId); // never leave a stale turn pending
  _c4TimerId = setTimeout(() => { _c4TimerId = null; if (_c4Active()) fn(); }, ms);
}

function _c4Say(text) {
  const el = document.getElementById("c4-status");
  el.innerHTML = _c4Girl
    ? `<span class="c4-face">${_c4Girl.e}</span> <strong>${_c4Esc(_c4Girl.name)}:</strong> ${_c4Esc(text)}`
    : _c4Esc(text);
}

function _c4Note(text) {
  document.getElementById("c4-status").innerHTML = _c4Esc(text);
}

function _c4Line(kind) {
  const pool = _c4Girl.lines[kind];
  return pool[Math.floor(Math.random() * pool.length)];
}

function _c4HUD() {
  document.getElementById("c4-hud").innerHTML =
    `<span>🟡 You <strong>${_c4Wins}</strong></span>` +
    `<span>${_c4Girl ? _c4Girl.e : ""} ${_c4Girl ? _c4Esc(_c4Girl.name) : ""} <strong>${_c4Losses}</strong></span>` +
    `<span>🍹 Tab <strong>฿${_c4Tab}</strong></span>`;
}

// Speak a vowel: single marks get the letterSpeech name, compounds fall
// back to the example word (same convention as the vowel drill).
function _c4Speak(v) {
  // TTS must never break the game state machine
  try {
    const named = letterSpeech(v[0]);
    if (named !== v[0].replace(/◌/g, "")) { _tts.speak(letterSpeechParts(v[0])); return; }
    const head = (v[3].match(/^([^\s(（]+)/) || [])[1];
    if (head) _tts.speak(head);
  } catch (_) {}
}

// ── Entry / hostess pick ───────────────────────────────────────────────────

function startConnect4() {
  showScreen("c4-screen", "C");
  if (_c4TimerId) { clearTimeout(_c4TimerId); _c4TimerId = null; }
  _c4Girl = null;
  _c4Phase = "pick";
  _c4Wins = 0; _c4Losses = 0; _c4Tab = 0;
  _c4HUD();
  _c4Note("Choose your opponent…");
  const body = document.getElementById("c4-body");
  body.innerHTML = `<div class="c4-pick">` + _C4_GIRLS.map((g, i) => `
    <button class="c4-girl" data-i="${i}">
      <span class="c4-girl-e">${g.e}</span>
      <span class="c4-girl-name">${_c4Esc(g.name)} <span class="c4-girl-th">(${_c4Esc(g.th)})</span></span>
      <span class="c4-girl-lv">${["Easy — first week", "Medium — knows the game", "Hard — the Mamasan"][i]}</span>
      <span class="c4-girl-blurb">${_c4Esc(g.blurb)}</span>
    </button>`).join("") + `</div>
    <p class="c4-stakes">House rules: answer a vowel right to aim your own shot.
    Get it wrong and the bar drops it anywhere. Loser buys the lady drink (฿150). 🍹</p>`;
  body.querySelectorAll(".c4-girl").forEach(btn =>
    btn.addEventListener("click", () => _c4Start(+btn.dataset.i)));
}

function _c4Start(girlIdx) {
  // cancel any turn still scheduled from a previous game (rematch mid-timer)
  if (_c4TimerId) { clearTimeout(_c4TimerId); _c4TimerId = null; }
  _c4Girl  = _C4_GIRLS[girlIdx];
  _c4Board = _c4NewBoard();
  _c4HUD();
  const body = document.getElementById("c4-body");
  body.innerHTML = `
    <div id="c4-quiz"></div>
    <div id="c4-board-wrap"><div id="c4-board"></div></div>`;
  _c4Render();
  if (_c4Girl.aiFirst) {
    _c4Say("Guests first? สุดหล่อ, this is MY bar. I go first 😈");
    _c4Phase = "ai";
    _c4Later(1400, _c4AiTurn);
  } else {
    _c4NextQuiz();
  }
}

// ── Board rendering ────────────────────────────────────────────────────────

function _c4Render(winCells) {
  const el = document.getElementById("c4-board");
  const winSet = new Set((winCells || []).map(([r, c]) => r + "," + c));
  let html = "";
  for (let c = 0; c < _C4_COLS; c++) {
    const live = _c4Phase === "drop" && _c4Board[0][c] === 0;
    html += `<div class="c4-col${live ? " c4-live" : ""}" data-col="${c}">`;
    for (let r = 0; r < _C4_ROWS; r++) {
      const v = _c4Board[r][c];
      const cls = v === 1 ? " p1" : v === 2 ? " p2" : "";
      const win = winSet.has(r + "," + c) ? " c4-wincell" : "";
      html += `<div class="c4-cell${cls}${win}"></div>`;
    }
    html += `</div>`;
  }
  el.innerHTML = html;
  el.querySelectorAll(".c4-col").forEach(col =>
    col.addEventListener("click", () => _c4PlayerDrop(+col.dataset.col)));

  // Animate the newest token falling from above the board into its row
  if (_c4LastDrop) {
    const { r, c } = _c4LastDrop;
    _c4LastDrop = null;
    const cell = el.children[c] && el.children[c].children[r];
    if (cell) {
      const h = cell.offsetHeight || 42;
      cell.style.setProperty("--fall", `-${(r + 1) * (h + 4) + 10}px`);
      cell.classList.add("c4-drop");
    }
  }
}

// ── Turn cycle ─────────────────────────────────────────────────────────────

function _c4NextQuiz() {
  _c4Phase   = "quiz";
  _c4Quiz    = _c4MakeQuiz();
  _c4Replays = 0;
  _c4Say(_c4Girl.level === 2 ? "Your vowel, ที่รัก. No pressure 😈" : "Your turn! Answer for your shot 🍸");
  const q = _c4Quiz;
  const el = document.getElementById("c4-quiz");
  const letters = ["1", "2", "3", "4"];
  // Listening quiz: the vowel is heard, not shown. Without a Thai voice
  // the romanisation is shown instead of playing audio.
  const hasTts = _tts.available();
  const prompt = hasTts
    ? `Which vowel do you hear? <button class="c4-speak" title="Replay" aria-label="Replay vowel">🔊</button>`
    : `Which vowel is <strong>${_c4Esc(q.answer[1])}</strong> — ${_c4Esc(q.answer[2])}?`;
  el.innerHTML = `
    <div class="c4-q-prompt">${prompt}</div>
    <div class="c4-q-hint" id="c4-q-hint"></div>
    <div class="c4-choices c4-choices-sym">` + q.choices.map((v, i) => `
      <button class="c4-choice c4-choice-sym" data-i="${i}">
        <span class="c4-cletter">${letters[i]}</span> <span class="c4-sym">${_c4Esc(vowelDisp(v[0]))}</span>
      </button>`).join("") + `</div>`;
  el.querySelectorAll(".c4-choice").forEach(btn =>
    btn.addEventListener("click", () => _c4Answer(+btn.dataset.i)));
  el.querySelector(".c4-speak")?.addEventListener("click", () => {
    _c4Speak(q.answer);
    // A second replay earns the romanisation as a hint
    if (++_c4Replays >= 2) {
      document.getElementById("c4-q-hint").textContent =
        `${q.answer[1]} — ${q.answer[2]}`;
    }
  });
  _c4Render();
  // Sound the vowel at the start of every player turn (letter, pause, name)
  if (hasTts) _c4Speak(q.answer);
}

function _c4Answer(i) {
  if (_c4Phase !== "quiz") return;
  const q = _c4Quiz;
  const chosen = q.choices[i];
  const btns = document.querySelectorAll(".c4-choice");
  btns.forEach(b => b.disabled = true);
  const correctIdx = q.choices.indexOf(q.answer);
  btns[correctIdx]?.classList.add("c4-ok");
  if (chosen === q.answer) {
    _c4Phase = "drop";
    _c4Say(_c4Line("right") + "  — pick your column!");
    // Collapse the quiz to one line so the board is visible for the drop
    document.getElementById("c4-quiz").innerHTML =
      `<div class="c4-q-mini">✓ ${_c4Esc(vowelDisp(q.answer[0]))} — ${_c4Esc(q.answer[1])} (${_c4Esc(q.answer[2])})</div>`;
    _c4Render();
  } else {
    btns[i]?.classList.add("c4-bad");
    _c4Say(_c4Line("wrong"));
    _c4Phase = "ai"; // input locked while the bar drops for you
    _c4Later(1600, () => {
      const valid = _c4ValidCols(_c4Board);
      const col = valid[Math.floor(Math.random() * valid.length)];
      _c4Place(col, 1, true);
    });
  }
  // Speak last: the phase transition above must never depend on TTS
  _c4Speak(q.answer);
}

function _c4PlayerDrop(col) {
  if (_c4Phase !== "drop") return;
  if (_c4Board[0][col] !== 0) return;
  _c4Place(col, 1, false);
}

function _c4Place(col, p, wasRandom) {
  const r = _c4DropRow(_c4Board, col);
  if (r < 0) return;
  _c4Board[r][col] = p;
  _c4LastDrop = { r, c: col }; // every downstream path re-renders
  document.getElementById("c4-quiz").innerHTML = "";
  const won = _c4Winner(_c4Board);
  if (won) { _c4End(won); return; }
  if (_c4Full(_c4Board)) { _c4End(null); return; }
  if (p === 1) {
    _c4Phase = "ai";
    _c4Render();
    if (wasRandom) _c4Note("The bar drops your token… 🎲");
    _c4Later(900 + Math.random() * 700, _c4AiTurn);
  } else {
    _c4NextQuiz();
  }
}

function _c4AiTurn() {
  const col = _c4AiMove(_c4Board, _c4Girl.level);
  if (col < 0) { _c4End(null); return; }
  if (Math.random() < 0.3) _c4Say(_c4Line("taunt"));
  _c4Place(col, 2, false);
}

// ── Game end ───────────────────────────────────────────────────────────────

function _c4End(won) {
  _c4Phase = "end";
  let kind;
  if (!won) kind = "draw";
  else if (won.p === 1) { kind = "lose"; _c4Wins++; }   // her "lose" lines
  else { kind = "win"; _c4Losses++; _c4Tab += 150; }
  _c4HUD();
  _c4Render(won ? won.cells : []);
  _c4Say(_c4Line(kind));
  const el = document.getElementById("c4-quiz");
  const title = !won ? "เสมอ — Draw!" : won.p === 1 ? "🏆 You win!" : `${_c4Girl.e} ${_c4Esc(_c4Girl.name)} wins!`;
  el.innerHTML = `
    <div class="c4-end">
      <div class="c4-end-title">${title}</div>
      ${won && won.p === 2 ? `<div class="c4-end-tab">+฿150 on your tab 🍹</div>` : ""}
      <div class="c4-end-btns">
        <button class="sb-btn" onclick="_c4Start(${_C4_GIRLS.indexOf(_c4Girl)})">อีกครั้ง — Rematch</button>
        <button class="sb-btn sb-btn-ghost" onclick="startConnect4()">Change girl</button>
        <button class="sb-btn sb-btn-ghost" onclick="endSession()">กลับบ้าน — Go home</button>
      </div>
    </div>`;

  // She won: teach the phrase she just used — vocab modal + audio for
  // ชนะแล้ว ("won!"), after her win line has had a moment to land.
  if (won && won.p === 2 && WORD_MAP["ชนะแล้ว"]) {
    _c4Later(1200, () => openWordModal(WORD_MAP["ชนะแล้ว"]));
  }
}

// ── Keyboard (desktop) ─────────────────────────────────────────────────────

function _c4Key(key) {
  if (!_c4Active()) return false;
  if (_c4Phase === "pick" && ["1", "2", "3"].includes(key)) {
    _c4Start(+key - 1);
    return true;
  }
  if (_c4Phase === "quiz" && ["1", "2", "3", "4"].includes(key)) {
    _c4Answer(+key - 1);
    return true;
  }
  if (_c4Phase === "drop" && ["1", "2", "3", "4", "5", "6", "7"].includes(key)) {
    _c4PlayerDrop(+key - 1);
    return true;
  }
  return false;
}
