// Walking Street — Pattaya Consonant Drop
// Thai consonants mapped to Kedmanee keyboard positions.
// Type the key shown to pop each neon sign before it hits the ground.
// Every 5 pops a random letter loses its key hint (warned by blinking first).

const GAME_LETTERS = [
  { thai: "ก", key: "d" },
  { thai: "น", key: "o" },
  { thai: "ส", key: "l" },
  { thai: "ท", key: "m" },
  { thai: "ป", key: "x" },
  { thai: "ร", key: "i" },
  { thai: "พ", key: "r" },
  { thai: "ห", key: "s" },
  { thai: "ด", key: "f" },
  { thai: "ย", key: "p" },
];

const _NEON = [
  "#ff1493","#00e5ff","#bf5fff","#ffe600",
  "#00ff7f","#ff6600","#ff4060","#00bfff",
  "#ff69b4","#7fff00",
];

// ── ASCII background art ───────────────────────────────────────────────────

// Pattaya hillside sign — rendered as canvas text in monospace
const _PATTAYA_ART = [
  "   *   *   *   *   *   *   *   *   *   *   *  ",
  " *                                             *",
  "   +===========================================+  ",
  "   |   * *   P A T T A Y A   * *             |  ",
  "   +===========================================+  ",
  " *                                             *",
  "   *   *   *   *   *   *   *   *   *   *   *  ",
];

// Three Walking Street go-go bars, each with a neon color and ASCII box art
const _GOGO_BARS = [
  {
    cx: 0.13, color: "#ff1493",
    art: [
      "+---------------+",
      "| * BUTTERFLY * |",
      "|   GO-GO BAR   |",
      "+---------------+",
    ],
  },
  {
    cx: 0.50, color: "#bf5fff",
    art: [
      "+----------------+",
      "| * SUGAR SUGAR *|",
      "|   A-GO-GO BAR  |",
      "+----------------+",
    ],
  },
  {
    cx: 0.84, color: "#00e5ff",
    art: [
      "+---------------+",
      "| * EDEN CLUB * |",
      "|   A-GO-GO BAR |",
      "+---------------+",
    ],
  },
];

// Static background lights (twinkling neon / distant signs)
const _BG_LIGHTS = Array.from({ length: 55 }, () => ({
  x:        Math.random(),
  y:        Math.random() * 0.68,
  r:        0.8 + Math.random() * 2,
  phase:    Math.random() * Math.PI * 2,
  colorIdx: Math.floor(Math.random() * _NEON.length),
}));

// Building silhouettes [normX, normWidth, normHeight]
const _BUILDINGS = [
  [0.00, 0.08, 0.28], [0.07, 0.05, 0.18],
  [0.13, 0.09, 0.35], [0.21, 0.06, 0.22],
  [0.27, 0.05, 0.15], [0.32, 0.09, 0.30],
  [0.40, 0.05, 0.20], [0.45, 0.08, 0.38],
  [0.53, 0.06, 0.19], [0.59, 0.09, 0.27],
  [0.68, 0.05, 0.23], [0.73, 0.08, 0.32],
  [0.81, 0.04, 0.17], [0.85, 0.07, 0.25],
  [0.92, 0.08, 0.20],
];

// ── 8-bit street sprites ──────────────────────────────────────────────────

const _SPR = 3; // display pixels per sprite-pixel

// Palm tree (7 × 11 sprite-pixels)
const _PALM_ROWS = [
  "..GGG..",
  ".GGGGG.",
  "GGGGGGG",
  ".GGGGG.",
  "..GGG..",
  "...T...",
  "...T...",
  "...T...",
  "...T...",
  "..TTT..",
  ".TTTTT.",
];
const _PALM_COL = { G: "#1e8c22", T: "#8b5010" };

// Person (5 × 8 sprite-pixels, 2 walk frames, drawn facing right)
const _WALK_FRAMES = [
  [".OOO.", ".OOO.", "BBBBB", ".BBB.", "S...S", "S...S", "SS...", "....S"],
  [".OOO.", ".OOO.", "BBBBB", ".BBB.", ".SSS.", ".SSS.", ".S...", "...S."],
];
const _WALK_SHIRTS = ["#cc3322","#2255cc","#22aa55","#cc8822","#7722cc","#cc2288"];
const _WALK_BASE   = { O: "#ffcc88", S: "#441100" };

// Motorbike (10 × 5 sprite-pixels, drawn facing right)
const _MOTO_ROWS = [
  ".....RR...",
  "....RBB...",
  "FBBBBBBBB.",
  ".WBB....WW",
  ".WW.....WW",
];
const _MOTO_COL = { F: "#999999", B: "#888888", R: "#ff4400", W: "#111122" };

// Baht bus / songthaew (14 × 6 sprite-pixels, drawn facing right, cab at right)
const _BUS_ROWS = [
  "..........CCCC",
  "RRRRRRRRRRCCCC",
  "RRRRRRRRRRCCCC",
  "RRRRRRRRRRCCCC",
  "..WW......WWWW",
  "..WW......WWWW",
];
const _BUS_COL = { C: "#223366", R: "#cc2222", W: "#111122" };

// Draw a pixel-art sprite. flipX mirrors it horizontally.
function _gDrawSprite(ctx, rows, colors, x, y, flipX) {
  const s  = _SPR;
  const cw = rows[0].length;
  ctx.save();
  if (flipX) {
    ctx.translate(Math.round(x) + cw * s, Math.round(y));
    ctx.scale(-1, 1);
  } else {
    ctx.translate(Math.round(x), Math.round(y));
  }
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      if (ch === "." || !colors[ch]) continue;
      ctx.fillStyle = colors[ch];
      ctx.fillRect(c * s, r * s, s, s);
    }
  }
  ctx.restore();
}

// ── State ──────────────────────────────────────────────────────────────────

// Per-letter hint state: 0 = show, 1 = warn (blink on next spawn), 2 = gone
const _gHintMode = new Array(GAME_LETTERS.length).fill(0);

let _gRunning   = false;
let _gCanvas    = null, _gCtx = null;
let _gBubbles   = [], _gParticles = [];
let _gScore     = 0, _gLives = 3, _gLevel = 1, _gPopped = 0;
let _gAnimId    = null, _gLastSpawn = 0;
let _gSpawnMs   = 2200, _gSpeed = 0.55;
let _gTime      = 0;
let _gStreetSprites = [], _gPalmTrees = [];
let _gLastStreetSpawn = 0, _gNextStreetIn = 0;

// ── Init ───────────────────────────────────────────────────────────────────

let _gTapBound = false;

function startGame() {
  showScreen("game-screen", "G");
  _gCanvas = document.getElementById("game-canvas");
  _gCtx    = _gCanvas.getContext("2d");
  if (IS_MOBILE && !_gTapBound) {
    _gTapBound = true;
    _gCanvas.addEventListener("pointerdown", _gTap);
  }
  _gResize();
  _gReset();
  document.getElementById("game-over-panel").style.display = "none";
  _gRunning = true;
  requestAnimationFrame(_gTick);
  _buildGameRef();
}

function _gResize() {
  const wrap      = document.getElementById("game-canvas-wrap");
  _gCanvas.width  = wrap.clientWidth;
  _gCanvas.height = wrap.clientHeight;
}

function _gReset() {
  _gBubbles = []; _gParticles = [];
  _gScore = 0; _gLives = 3; _gLevel = 1; _gPopped = 0;
  _gLastSpawn = 0; _gSpawnMs = 2200; _gSpeed = 0.55;
  _gTime = 0;
  _gHintMode.fill(0);
  _gStreetSprites = [];
  _gLastStreetSpawn = 0;
  _gNextStreetIn = 800 + Math.random() * 1200;
  // Palm trees at fixed fractional x positions
  _gPalmTrees = [0.05, 0.20, 0.47, 0.66, 0.86].map(fx => ({
    x: Math.round(fx * Math.max(1, _gCanvas.width - _PALM_ROWS[0].length * _SPR)),
  }));
  _gHUD();
}

function _gHUD() {
  document.getElementById("game-score").textContent = _gScore;
  document.getElementById("game-lives").textContent = "🍺".repeat(_gLives);
  document.getElementById("game-level").textContent = _gLevel;
}

// ── Game loop ──────────────────────────────────────────────────────────────

function _gSpawn(now) {
  const idx  = Math.floor(Math.random() * GAME_LETTERS.length);
  const mode = _gHintMode[idx];
  const r    = 36;
  const x    = r + 20 + Math.random() * (_gCanvas.width - 2 * r - 40);
  _gBubbles.push({
    letter:    GAME_LETTERS[idx],
    letterIdx: idx,
    color:     _NEON[idx],
    x, y: -r - 10, r,
    speed:      _gSpeed * (0.8 + Math.random() * 0.4),
    popped:     false, popT: 0,
    wrongFlash: 0,
    showHint:   mode !== 2,
    blink:      mode === 1,
    bounced:    false, vx: 0, vy: 0,
  });
  _gLastSpawn = now;
}

function _gTick(now) {
  if (!_gRunning) return;
  _gTime = now;

  if (now - _gLastSpawn > _gSpawnMs) _gSpawn(now);

  // Street sprites — move + knocked physics
  if (now - _gLastStreetSpawn > _gNextStreetIn) _gSpawnStreetSprite(now);
  const H = _gCanvas.height, W = _gCanvas.width;
  const groundY = H * 0.82;
  for (const s of _gStreetSprites) {
    s.x += s.vx;
    if (s.knocked) { s.dy += s.vy; s.vy += 0.38; s.rot += s.rotV; }
  }
  _gStreetSprites = _gStreetSprites.filter(s => {
    if (s.knocked) return groundY + s.dy < H + 120;
    return s.vx > 0 ? s.x < W + 160 : s.x > -160;
  });

  // Update bubbles
  const dead = [];
  for (const b of _gBubbles) {
    if (b.popped) { b.popT += 0.07; if (b.popT >= 1) dead.push(b); continue; }
    if (b.wrongFlash > 0) b.wrongFlash--;
    if (b.bounced) {
      b.x += b.vx; b.y += b.vy; b.vy += 0.12;
      const offScreen = b.y - b.r > _gCanvas.height ||
                        b.x + b.r < 0 || b.x - b.r > _gCanvas.width;
      if (offScreen) dead.push(b); // no life penalty
    } else {
      b.y += b.speed;
      if (b.y - b.r > _gCanvas.height) {
        _gResolve(b);
        _gLives--;
        _gHUD();
        _gMissParticles(b.x, _gCanvas.height - 15);
        dead.push(b);
        if (_gLives <= 0) {
          for (const d of dead) { const i = _gBubbles.indexOf(d); if (i >= 0) _gBubbles.splice(i, 1); }
          _gOver();
          return;
        }
      }
    }
  }
  // Collision: bubble vs street sprite
  for (const b of _gBubbles) {
    if (b.popped || b.bounced) continue;
    for (const s of _gStreetSprites) {
      if (s.knocked) continue;
      const rows = s.type === "person" ? _WALK_FRAMES[0] : s.rows;
      const sW   = rows[0].length * _SPR;
      const sH   = rows.length    * _SPR;
      const sX   = s.x, sY = groundY - sH;
      const nearX = Math.max(sX, Math.min(b.x, sX + sW));
      const nearY = Math.max(sY, Math.min(b.y, sY + sH));
      if (Math.hypot(b.x - nearX, b.y - nearY) < b.r) {
        // Bounce the bubble
        b.bounced = true;
        b.vx      = (Math.random() - 0.5) * 9;
        b.vy      = 2 + Math.random() * 3;
        _gBounceParticles(b.x, b.y, b.color);
        // Knock the sprite off screen
        s.knocked = true;
        s.vy      = -(4 + Math.random() * 5);
        s.vx     += (Math.random() - 0.5) * 8;
        s.rotV    = (Math.random() - 0.5) * 0.25;
        break;
      }
    }
  }
  for (const b of dead) { const i = _gBubbles.indexOf(b); if (i >= 0) _gBubbles.splice(i, 1); }

  // Update particles
  for (const p of _gParticles) { p.x += p.vx; p.y += p.vy; p.vy += 0.14; p.a -= 0.032; }
  _gParticles = _gParticles.filter(p => p.a > 0);

  _gDraw();
  _gAnimId = requestAnimationFrame(_gTick);
}

// Called when a warning bubble resolves — transitions hint from warn → gone
function _gResolve(b) {
  if (b.blink && _gHintMode[b.letterIdx] === 1) {
    _gHintMode[b.letterIdx] = 2;
    _gDimRefCard(b.letterIdx);
  }
}

function _gOver() {
  _gRunning = false;
  cancelAnimationFrame(_gAnimId);
  document.getElementById("game-final-score").textContent = _gScore;
  document.getElementById("game-over-panel").style.display = "flex";
}

// ── Background ─────────────────────────────────────────────────────────────

function _gDrawBg(ctx, W, H) {
  const groundY = H * 0.82;

  // Night sky
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#03000e");
  sky.addColorStop(0.65, "#09001e");
  sky.addColorStop(1, "#14000e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Pratumnak hill silhouette behind the sign
  ctx.fillStyle = "#060016";
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.bezierCurveTo(W * 0.18, groundY * 0.99, W * 0.38, H * 0.07, W * 0.50, H * 0.09);
  ctx.bezierCurveTo(W * 0.62, H * 0.07, W * 0.82, groundY * 0.99, W, groundY);
  ctx.closePath();
  ctx.fill();

  // Pattaya hilltop sign
  _gDrawPattayaSign(ctx, W, H);

  // Twinkling neon lights / distant signs
  for (const l of _BG_LIGHTS) {
    const flicker = 0.35 + 0.65 * Math.abs(Math.sin(_gTime * 0.0009 + l.phase));
    ctx.globalAlpha = flicker * 0.55;
    ctx.fillStyle = _NEON[l.colorIdx];
    ctx.beginPath();
    ctx.arc(l.x * W, l.y * H, l.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Building silhouettes with lit windows
  ctx.fillStyle = "#050010";
  for (const [bx, bw, bh] of _BUILDINGS) {
    const px = bx * W, pw = bw * W, ph = bh * H;
    ctx.fillRect(px, groundY - ph, pw, ph);
    const cols = Math.max(1, Math.floor(pw / 11));
    const rows = Math.max(1, Math.floor(ph / 15));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.sin(bx * 91 + r * 7.3 + c * 11.7 + _gTime * 0.00015) <= 0.1) continue;
        const wi = Math.floor((bx * 10 + r + c) % _NEON.length);
        ctx.fillStyle = _NEON[wi] + "50";
        ctx.fillRect(px + 3 + c * 11, groundY - ph + 4 + r * 15, 7, 9);
      }
    }
  }

  // Go-go bar signs on the street
  _gDrawGoGoSigns(ctx, W, H, groundY);

  // Street surface
  const street = ctx.createLinearGradient(0, groundY, 0, H);
  street.addColorStop(0, "#130020");
  street.addColorStop(1, "#08000e");
  ctx.fillStyle = street;
  ctx.fillRect(0, groundY, W, H - groundY);

  // Wet-street neon reflections
  ctx.globalAlpha = 0.1;
  for (const l of _BG_LIGHTS.slice(0, 14)) {
    ctx.fillStyle = _NEON[l.colorIdx];
    ctx.fillRect(l.x * W - 1.5, groundY, 3, H - groundY);
  }
  ctx.globalAlpha = 1;

  // Danger zone line
  ctx.strokeStyle = "rgba(255,20,147,0.22)";
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 5]);
  ctx.beginPath(); ctx.moveTo(0, H - 6); ctx.lineTo(W, H - 6); ctx.stroke();
  ctx.setLineDash([]);
}

function _gDrawPattayaSign(ctx, W, H) {
  const cx      = W / 2;
  const fontSize = Math.max(12, Math.round(W / 30));
  const lineH   = Math.round(fontSize * 1.35);
  const totalH  = _PATTAYA_ART.length * lineH;
  const signTop = H * 0.06;
  // Layered neon flicker: slow drift + fast buzz + occasional dropout
  const drift   = Math.abs(Math.sin(_gTime * 0.0011));
  const buzz    = 0.5 + 0.5 * Math.abs(Math.sin(_gTime * 0.031));
  const dropout = Math.sin(_gTime * 0.0019) > 0.82 ? 0.15 : 1.0;
  const flicker = (0.45 + 0.35 * drift + 0.20 * buzz) * dropout;

  ctx.save();
  ctx.font         = `bold ${fontSize}px 'Courier New', Courier, monospace`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";

  for (let i = 0; i < _PATTAYA_ART.length; i++) {
    const line     = _PATTAYA_ART[i];
    const y        = signTop + i * lineH;
    const isBorder = line.includes("+") || line.includes("=");
    const isText   = line.includes("P A T T A Y A");

    if (isText) {
      ctx.shadowColor = "rgba(255,245,150,0.9)";
      ctx.shadowBlur  = 12;
      ctx.fillStyle   = `rgba(255,250,200,${flicker})`;
    } else if (isBorder) {
      ctx.shadowColor = "rgba(180,160,255,0.7)";
      ctx.shadowBlur  = 8;
      ctx.fillStyle   = `rgba(210,190,255,${0.75 * flicker})`;
    } else {
      ctx.shadowColor = "rgba(150,170,255,0.4)";
      ctx.shadowBlur  = 4;
      ctx.fillStyle   = `rgba(180,200,255,${0.50 * flicker})`;
    }
    ctx.fillText(line, cx, y);
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

function _gDrawGoGoSigns(ctx, W, H, groundY) {
  const fontSize = Math.max(11, Math.round(W / 36));
  const lineH   = Math.round(fontSize * 1.4);

  ctx.save();
  ctx.font         = `bold ${fontSize}px 'Courier New', Courier, monospace`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";

  for (const bar of _GOGO_BARS) {
    const cx      = bar.cx * W;
    // Place signs so their bottom aligns just above the street
    const baseY   = groundY - bar.art.length * lineH - 6;
    const drift   = Math.abs(Math.sin(_gTime * 0.0013 + bar.cx * 19));
    const buzz    = 0.5 + 0.5 * Math.abs(Math.sin(_gTime * 0.028 + bar.cx * 7));
    const dropout = Math.sin(_gTime * 0.0021 + bar.cx * 31) > 0.80 ? 0.12 : 1.0;
    const flicker = (0.50 + 0.30 * drift + 0.20 * buzz) * dropout;

    ctx.shadowColor = bar.color;
    ctx.shadowBlur  = 14;

    for (let i = 0; i < bar.art.length; i++) {
      const isBorder = bar.art[i].includes("+") || bar.art[i].includes("-");
      const alpha    = isBorder ? 0.65 * flicker : 0.90 * flicker;
      ctx.fillStyle  = bar.color + Math.round(alpha * 255).toString(16).padStart(2, "0");
      ctx.fillText(bar.art[i], cx, baseY + i * lineH);
    }
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ── Bubbles ────────────────────────────────────────────────────────────────

function _gDrawBubble(ctx, b) {
  ctx.save();
  const shake = b.wrongFlash > 0 ? (Math.random() - 0.5) * 6 : 0;
  ctx.translate(b.x + shake, b.y);

  if (b.popped) {
    ctx.scale(1 + b.popT * 0.9, 1 + b.popT * 0.9);
    ctx.globalAlpha = 1 - b.popT;
  }

  const c = b.wrongFlash > 0 ? "#ff0040" : b.color;
  const r = b.r;

  // Outer glow rings
  for (let g = 4; g >= 1; g--) {
    ctx.beginPath();
    ctx.arc(0, 0, r + g * 5, 0, Math.PI * 2);
    ctx.fillStyle = c + Math.floor(14 / g).toString(16).padStart(2, "0");
    ctx.fill();
  }

  // Dark fill
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = "#07001a";
  ctx.fill();

  // Neon border — soft wide + crisp thin
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.strokeStyle = c + "55";
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.strokeStyle = c;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Thai character
  ctx.shadowColor  = c;
  ctx.shadowBlur   = 14;
  ctx.fillStyle    = "#ffffff";
  ctx.font         = "bold 28px 'Noto Sans Thai','Leelawadee UI',serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(b.letter.thai, 0, -5);
  ctx.shadowBlur = 0;

  // Key hint — blinking on warning fall, hidden once gone
  if (b.showHint) {
    const blinkOn = !b.blink || (Math.floor(_gTime / 130) % 2 === 0);
    if (blinkOn) {
      if (b.blink) {
        // White flash to signal "this hint is about to disappear"
        const pulse = 0.6 + 0.4 * Math.abs(Math.sin(_gTime * 0.013));
        ctx.fillStyle = `rgba(255,255,255,${pulse})`;
      } else {
        ctx.fillStyle = c + "cc";
      }
      ctx.font = "bold 11px 'Segoe UI', monospace, sans-serif";
      ctx.fillText(b.letter.key, 0, 16);
    }
  }

  ctx.restore();
}

function _gDraw() {
  const ctx = _gCtx, W = _gCanvas.width, H = _gCanvas.height;
  _gDrawBg(ctx, W, H);
  _gDrawStreet(ctx, W, H);
  for (const b of _gBubbles) _gDrawBubble(ctx, b);

  for (const p of _gParticles) {
    ctx.globalAlpha = p.a;
    ctx.shadowColor = p.c;
    ctx.shadowBlur  = 8;
    ctx.fillStyle   = p.c;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;
}

// ── Street sprites ────────────────────────────────────────────────────────

function _gSpawnStreetSprite(now) {
  const W       = _gCanvas.width;
  const goRight = Math.random() < 0.5;
  const roll    = Math.random();
  let type, vx, rows, colors, shirtIdx;

  if (roll < 0.50) {
    // Person walking
    type     = "person";
    vx       = (0.8 + Math.random() * 0.7) * (goRight ? 1 : -1);
    rows     = null; // chosen at draw time from _WALK_FRAMES
    shirtIdx = Math.floor(Math.random() * _WALK_SHIRTS.length);
    colors   = Object.assign({ B: _WALK_SHIRTS[shirtIdx] }, _WALK_BASE);
  } else if (roll < 0.85) {
    // Motorbike
    type   = "moto";
    vx     = (2.5 + Math.random() * 2.0) * (goRight ? 1 : -1);
    rows   = _MOTO_ROWS;
    colors = _MOTO_COL;
  } else {
    // Baht bus (songthaew) — rarer
    type   = "bus";
    vx     = (1.2 + Math.random() * 1.0) * (goRight ? 1 : -1);
    rows   = _BUS_ROWS;
    colors = _BUS_COL;
  }

  const sprW = (rows || _WALK_FRAMES[0])[0].length * _SPR;
  _gStreetSprites.push({
    type, vx, rows, colors,
    x: goRight ? -sprW - 10 : W + 10,
    knocked: false, dy: 0, vy: 0, rot: 0, rotV: 0,
  });

  _gLastStreetSpawn = now;
  _gNextStreetIn    = 800 + Math.random() * 2200;
}

function _gDrawStreet(ctx, W, H) {
  const groundY = H * 0.82;

  // Static palm trees
  for (const palm of _gPalmTrees) {
    const y = groundY - _PALM_ROWS.length * _SPR;
    _gDrawSprite(ctx, _PALM_ROWS, _PALM_COL, palm.x, y, false);
  }

  // Moving sprites — feet at groundY
  for (const s of _gStreetSprites) {
    const flipX = s.vx < 0;
    const rows  = s.type === "person" ? _WALK_FRAMES[Math.floor(_gTime / 220) % 2] : s.rows;
    const sW    = rows[0].length * _SPR;
    const sH    = rows.length    * _SPR;
    const baseY = groundY - sH + s.dy;

    if (s.knocked && s.rot !== 0) {
      ctx.save();
      ctx.translate(s.x + sW / 2, baseY + sH / 2);
      ctx.rotate(s.rot);
      _gDrawSprite(ctx, rows, s.colors, -sW / 2, -sH / 2, flipX);
      ctx.restore();
    } else {
      _gDrawSprite(ctx, rows, s.colors, s.x, baseY, flipX);
    }
  }
}

// ── Particles ──────────────────────────────────────────────────────────────

function _gPopParticles(x, y, color) {
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
    const spd   = 1.5 + Math.random() * 4;
    _gParticles.push({ x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 2,
      r: 2 + Math.random() * 3, c: color, a: 1 });
  }
}

function _gBounceParticles(x, y, color) {
  for (let i = 0; i < 8; i++) {
    const angle = Math.PI + (Math.random() - 0.5) * Math.PI; // downward fan
    const spd   = 2 + Math.random() * 3;
    _gParticles.push({ x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
      r: 2 + Math.random() * 2, c: color, a: 1 });
  }
}

function _gMissParticles(x, y) {
  for (let i = 0; i < 10; i++) {
    _gParticles.push({ x: x + (Math.random() - 0.5) * 40, y,
      vx: (Math.random() - 0.5) * 3, vy: -2 - Math.random() * 3,
      r: 2 + Math.random() * 2, c: "#ff0040", a: 1 });
  }
}

// ── Input ──────────────────────────────────────────────────────────────────

function _gKey(key) {
  if (!_gRunning) return false;
  const k = key.toLowerCase();
  if (!GAME_LETTERS.some(l => l.key === k)) return false;

  // Target the lowest matching bubble (most urgent)
  let target = null;
  for (const b of _gBubbles) {
    if (!b.popped && b.letter.key === k && (!target || b.y > target.y)) target = b;
  }

  if (target) {
    _gPopBubble(target);
  } else {
    // Valid key but no matching bubble — shake everything
    for (const b of _gBubbles) { if (!b.popped) b.wrongFlash = 6; }
  }
  return true;
}

function _gPopBubble(target) {
  _gResolve(target);
  _gPopParticles(target.x, target.y, target.color);
  target.popped = true;
  _gScore += 10 * _gLevel;
  _gPopped++;

  // Every 5 pops: schedule a random consonant for hint removal
  if (_gPopped % 5 === 0) {
    const eligible = GAME_LETTERS.map((_, i) => i).filter(i => _gHintMode[i] === 0);
    if (eligible.length > 0) {
      _gHintMode[eligible[Math.floor(Math.random() * eligible.length)]] = 1;
    }
  }

  // Every 10 pops: level up
  if (_gPopped % 10 === 0) {
    _gLevel++;
    _gSpawnMs = Math.max(650, _gSpawnMs - 250);
    _gSpeed   = Math.min(3.2, _gSpeed + 0.22);
  }

  _gHUD();
}

// Touch input: on mobile there is no keyboard, so tapping a sign pops it.
function _gTap(e) {
  if (!_gRunning) return;
  const rect = _gCanvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (_gCanvas.width  / rect.width);
  const y = (e.clientY - rect.top)  * (_gCanvas.height / rect.height);
  let target = null, best = Infinity;
  for (const b of _gBubbles) {
    if (b.popped || b.bounced) continue;
    const d = Math.hypot(b.x - x, b.y - y);
    if (d < b.r + 16 && d < best) { best = d; target = b; }
  }
  if (target) _gPopBubble(target);
}

// ── Reference strip ────────────────────────────────────────────────────────

function _buildGameRef() {
  const ref = document.getElementById("game-ref");
  ref.innerHTML = "";
  for (let i = 0; i < GAME_LETTERS.length; i++) {
    const l   = GAME_LETTERS[i];
    const c   = _NEON[i];
    const div = document.createElement("div");
    div.className = "game-ref-card";
    div.id        = "game-ref-" + i;
    div.style.borderColor = c + "70";
    div.innerHTML =
      `<span class="game-ref-thai" style="color:${c};text-shadow:0 0 8px ${c}">${l.thai}</span>` +
      `<span class="game-ref-key" id="game-ref-key-${i}" style="color:${c}bb">${l.key}</span>`;
    ref.appendChild(div);
  }
}

// Dim a reference card's key label when that hint is permanently removed
function _gDimRefCard(idx) {
  const el = document.getElementById("game-ref-key-" + idx);
  if (!el) return;
  el.style.opacity        = "0.18";
  el.style.textDecoration = "line-through";
}
