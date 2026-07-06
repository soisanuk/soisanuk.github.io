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

// Unlocked one per night beyond the defaults (common consonants first).
// Keys follow the same Kedmanee mapping as TUTOR_ALL.
const _GAME_EXTRA = [
  { thai: "ม", key: "," },
  { thai: "ว", key: ";" },
  { thai: "อ", key: "v" },
  { thai: "ฟ", key: "a" },
  { thai: "ผ", key: "z" },
];

const _GAME_ALL = GAME_LETTERS.concat(_GAME_EXTRA);

const _NEON = [
  "#ff1493","#00e5ff","#bf5fff","#ffe600",
  "#00ff7f","#ff6600","#ff4060","#00bfff",
  "#ff69b4","#7fff00",
  // extras
  "#ffaa00","#00ffcc","#d0ff00","#ff77ff","#66aaff",
];

// ── ASCII background art ───────────────────────────────────────────────────

// Go-go / girly-bar box signs at street level (canvas monospace, centred).
// Lines outside the +--+ box are marquee strips that blink on/off.
// minW: skipped on canvases narrower than this so phones aren't wallpapered.
const _GOGO_BARS = [
  {
    cx: 0.13, color: "#ff69b4", minW: 0,
    art: [
      "+----------------+",
      "| * PINK LOTUS * |",
      "|     LOUNGE     |",
      "+----------------+",
    ],
  },
  {
    cx: 0.38, color: "#bf5fff", minW: 640,
    art: [
      "+------------------+",
      "| * NEON PARADISE *|",
      "|     A-GO-GO      |",
      "+------------------+",
      " GIRLS GIRLS GIRLS ",
    ],
  },
  {
    cx: 0.62, color: "#ffaa00", minW: 640,
    art: [
      "+-----------------+",
      "| * LUCKY TIGER * |",
      "|    BEER  BAR    |",
      "+-----------------+",
      "  * OPEN  LATE *  ",
    ],
  },
  {
    cx: 0.87, color: "#00e5ff", minW: 0,
    art: [
      "+------------------+",
      "|* CRYSTAL PALACE *|",
      "|     A-GO-GO      |",
      "+------------------+",
    ],
  },
];

// Rooftop vertical neon signs — stacked letters, Walking Street style
const _VSIGNS = [
  { cx: 0.255, color: "#ff1493", minW: 0,   word: "GOGO"   },
  { cx: 0.50,  color: "#ffe600", minW: 520, word: "GIRLS"  },
  { cx: 0.745, color: "#00ff7f", minW: 0,   word: "MIRAGE" },
];

// Starfield (upper half of the sky, above the rooftops)
const _STARS = Array.from({ length: 110 }, () => ({
  x:     Math.random(),
  y:     Math.random() * 0.5,
  r:     0.5 + Math.random() * 1.3,
  phase: Math.random() * Math.PI * 2,
}));

// Shophouse row [normX, normWidth, storeys] — one shared facade colour, 2–3
// storeys tall, drawn edge to edge (widths sum to 1)
const _BUILDINGS = [
  [0.00, 0.09, 2], [0.09, 0.07, 3], [0.16, 0.10, 2], [0.26, 0.08, 3],
  [0.34, 0.09, 2], [0.43, 0.07, 3], [0.50, 0.10, 2], [0.60, 0.08, 3],
  [0.68, 0.09, 2], [0.77, 0.07, 3], [0.84, 0.09, 2], [0.93, 0.07, 3],
];
const _BLDG_FACADE = "#190a2b";
const _BLDG_STOREY = 0.075; // storey height as a fraction of canvas height

// ── 8-bit street sprites ──────────────────────────────────────────────────

const _SPR = 3; // display pixels per sprite-pixel

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
// Grab driver variant — green jacket, green bike
const _MOTO_GRAB_COL = { F: "#999999", B: "#1f8a45", R: "#00b14f", W: "#111122" };

// Baht bus / songthaew (14 × 6 sprite-pixels, drawn facing right, cab at right).
// Pattaya's baht buses are blue.
const _BUS_ROWS = [
  "..........CCCC",
  "RRRRRRRRRRCCCC",
  "RRRRRRRRRRCCCC",
  "RRRRRRRRRRCCCC",
  "..WW......WWWW",
  "..WW......WWWW",
];
const _BUS_COL = { C: "#16307a", R: "#2255cc", W: "#111122" };

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
const _gHintMode = new Array(_GAME_ALL.length).fill(0);
let _gPool = GAME_LETTERS.length; // letters currently in play; grows each night

let _gRunning   = false;
let _gCanvas    = null, _gCtx = null;
let _gBubbles   = [], _gParticles = [];
let _gScore     = 0, _gLives = 3, _gLevel = 1, _gPopped = 0;
let _gAnimId    = null, _gLastSpawn = 0;
let _gSpawnMs   = 2200, _gSpeed = 0.55;
let _gTime      = 0;
let _gStreetSprites = [];
let _gLastStreetSpawn = 0, _gNextStreetIn = 0;

// ── Init ───────────────────────────────────────────────────────────────────

function startGame() {
  showScreen("game-screen", "G");
  _gCanvas = document.getElementById("game-canvas");
  _gCtx    = _gCanvas.getContext("2d");
  _gResize();
  _gReset();
  document.getElementById("game-over-panel").style.display = "none";
  _gRunning = true;
  requestAnimationFrame(_gTick);
  _buildGameRef();
  if (IS_MOBILE) _gBuildKbd();
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
  _gPool = GAME_LETTERS.length;
  _gStreetSprites = [];
  _gLastStreetSpawn = 0;
  _gNextStreetIn = 400 + Math.random() * 800;
  // Start with a few pedestrians already strolling
  for (let i = 0; i < 4; i++) {
    const s = _gMakeStreetSprite(true);
    s.x = Math.random() * Math.max(1, _gCanvas.width - 40);
    _gStreetSprites.push(s);
  }
  _gHUD();
}

function _gHUD() {
  document.getElementById("game-score").textContent = _gScore;
  document.getElementById("game-lives").textContent = "🍺".repeat(_gLives);
  document.getElementById("game-level").textContent = _gLevel;
}

// ── Game loop ──────────────────────────────────────────────────────────────

function _gSpawn(now) {
  const idx  = Math.floor(Math.random() * _gPool);
  const mode = _gHintMode[idx];
  const r    = 36;
  const x    = r + 20 + Math.random() * (_gCanvas.width - 2 * r - 40);
  _gBubbles.push({
    letter:    _GAME_ALL[idx],
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
        _audio.sfx("miss");
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
        _audio.sfx("bounce");
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
  _audio.stop();
  _audio.sfx("gameover");
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

  // Twinkling stars
  ctx.fillStyle = "#ffffff";
  for (const s of _STARS) {
    ctx.globalAlpha = (0.3 + 0.7 * Math.abs(Math.sin(_gTime * 0.0006 + s.phase))) * 0.8;
    ctx.fillRect(s.x * W, s.y * H, s.r, s.r);
  }
  ctx.globalAlpha = 1;

  _gDrawMoon(ctx, W, H);

  // Shophouse row — uniform facade, 2–3 storeys
  const storeyH = H * _BLDG_STOREY;
  for (const [bx, bw, storeys] of _BUILDINGS) {
    const px = bx * W, pw = bw * W, ph = storeys * storeyH;
    ctx.fillStyle = _BLDG_FACADE;
    ctx.fillRect(px, groundY - ph, pw, ph);
    ctx.fillStyle = "#2a1244"; // roof lip
    ctx.fillRect(px, groundY - ph, pw, 3);
    ctx.fillStyle = "#0e0518"; // party-wall seam
    ctx.fillRect(px + pw - 1, groundY - ph, 1, ph);
    // Windows, one row per storey — a few lit with warm room light
    const cols = Math.max(1, Math.floor(pw / 16));
    for (let s = 0; s < storeys; s++) {
      for (let c = 0; c < cols; c++) {
        const lit = Math.sin(bx * 91 + s * 7.3 + c * 11.7) > 0.55;
        ctx.fillStyle = lit ? "rgba(255,204,120,0.20)" : "#0d0420";
        ctx.fillRect(px + 5 + c * 16, groundY - ph + 8 + s * storeyH, 8, storeyH * 0.45);
      }
    }
  }

  // Signage — the main attraction
  _gDrawVSigns(ctx, W, H, groundY);
  _gDrawGoGoSigns(ctx, W, H, groundY);

  // Street surface
  const street = ctx.createLinearGradient(0, groundY, 0, H);
  street.addColorStop(0, "#130020");
  street.addColorStop(1, "#08000e");
  ctx.fillStyle = street;
  ctx.fillRect(0, groundY, W, H - groundY);

  // Wet-street reflections under each neon sign
  ctx.globalAlpha = 0.1;
  for (const s of _GOGO_BARS.concat(_VSIGNS)) {
    if (W < s.minW) continue;
    ctx.fillStyle = s.color;
    ctx.fillRect(s.cx * W - 2.5, groundY, 5, H - groundY);
  }
  ctx.globalAlpha = 1;

  // Danger zone line
  ctx.strokeStyle = "rgba(255,20,147,0.22)";
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 5]);
  ctx.beginPath(); ctx.moveTo(0, H - 6); ctx.lineTo(W, H - 6); ctx.stroke();
  ctx.setLineDash([]);
}

function _gDrawMoon(ctx, W, H) {
  const mx = W * 0.86, my = H * 0.12, mr = Math.max(13, Math.min(W, H) * 0.045);
  ctx.save();
  ctx.shadowColor = "rgba(255,246,214,0.9)";
  ctx.shadowBlur  = mr * 1.5;
  ctx.fillStyle   = "#f6eecb";
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Maria (the dark patches)
  ctx.fillStyle = "rgba(205,190,150,0.55)";
  for (const [dx, dy, dr] of [[-0.30, -0.12, 0.20], [0.22, 0.28, 0.13], [0.05, -0.38, 0.10]]) {
    ctx.beginPath();
    ctx.arc(mx + dx * mr, my + dy * mr, dr * mr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Vertical stacked-letter neon signs rising from the rooftops
function _gDrawVSigns(ctx, W, H, groundY) {
  const fontSize = Math.max(12, Math.round(W / 40));
  const lineH    = Math.round(fontSize * 1.2);

  ctx.save();
  ctx.font         = `bold ${fontSize}px 'Courier New', Courier, monospace`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";

  for (const sign of _VSIGNS) {
    if (W < sign.minW) continue;
    const chars = [...sign.word];
    const boxW  = Math.round(fontSize * 1.9);
    const boxH  = chars.length * lineH + Math.round(fontSize * 0.8);
    const cx    = sign.cx * W;
    const top   = groundY - 2 * H * _BLDG_STOREY - boxH; // bottom sits on a 2-storey roof
    const drift   = Math.abs(Math.sin(_gTime * 0.0012 + sign.cx * 23));
    const buzz    = 0.5 + 0.5 * Math.abs(Math.sin(_gTime * 0.026 + sign.cx * 11));
    const dropout = Math.sin(_gTime * 0.0017 + sign.cx * 41) > 0.84 ? 0.15 : 1.0;
    const flicker = (0.50 + 0.30 * drift + 0.20 * buzz) * dropout;
    const a       = Math.round(flicker * 255).toString(16).padStart(2, "0");

    ctx.fillStyle = "rgba(10,0,24,0.85)"; // dark backing panel
    ctx.fillRect(cx - boxW / 2, top, boxW, boxH);
    ctx.shadowColor = sign.color;
    ctx.shadowBlur  = 12;
    ctx.strokeStyle = sign.color + a;
    ctx.lineWidth   = 2;
    ctx.strokeRect(cx - boxW / 2, top, boxW, boxH);
    ctx.fillStyle = sign.color + a;
    chars.forEach((ch, i) =>
      ctx.fillText(ch, cx, top + Math.round(fontSize * 0.4) + i * lineH)
    );
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function _gDrawGoGoSigns(ctx, W, H, groundY) {
  const fontSize = Math.max(10, Math.round(W / 52));
  const lineH   = Math.round(fontSize * 1.4);

  ctx.save();
  ctx.font         = `bold ${fontSize}px 'Courier New', Courier, monospace`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";

  for (const bar of _GOGO_BARS) {
    if (W < bar.minW) continue;
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
      const line  = bar.art[i];
      const boxed = line.startsWith("+") || line.startsWith("|");
      // Marquee strips outside the box blink on/off instead of flickering
      if (!boxed && Math.sin(_gTime * 0.005 + bar.cx * 37) < -0.25) continue;
      const isBorder = line.startsWith("+");
      const alpha    = (isBorder ? 0.65 : boxed ? 0.90 : 1.0) * flicker;
      ctx.fillStyle  = bar.color + Math.round(alpha * 255).toString(16).padStart(2, "0");
      ctx.fillText(line, cx, baseY + i * lineH);
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
  // textAlign centres the advance width, but Thai glyphs carry uneven side
  // bearings, so the visible ink sits right of centre. Offset by the ink box.
  ctx.fillText(b.letter.thai, _gGlyphDx(ctx, b.letter.thai), -5);
  ctx.shadowBlur = 0;

  // Key hint — blinking on warning fall, hidden once gone.
  // Mobile input is the Thai key row, so Latin hints are never drawn there.
  if (b.showHint && !IS_MOBILE) {
    const blinkOn = !b.blink || (Math.floor(_gTime / 130) % 2 === 0);
    if (blinkOn) {
      if (b.blink) {
        // White flash to signal "this hint is about to disappear"
        const pulse = 0.6 + 0.4 * Math.abs(Math.sin(_gTime * 0.013));
        ctx.fillStyle = `rgba(255,255,255,${pulse})`;
      } else {
        ctx.fillStyle = c + "cc";
      }
      ctx.font = "bold 17px 'Segoe UI', monospace, sans-serif";
      ctx.fillText(b.letter.key, 0, 19);
    }
  }

  ctx.restore();
}

// Horizontal offset that centres a glyph's ink on x=0 (with textAlign:center
// already set). measureText's bounding boxes lie on some platforms (Android
// synthetic-bolds Thai and widens strokes without reporting it), so rasterise
// the glyph once to a scratch canvas and scan the actual pixels instead.
const _gGlyphDxCache = {};
function _gGlyphDx(ctx, ch) {
  if (!(ch in _gGlyphDxCache)) {
    const S = 64;
    const scratch = document.createElement("canvas");
    scratch.width = scratch.height = S;
    const sctx = scratch.getContext("2d", { willReadFrequently: true });
    sctx.font = ctx.font;
    sctx.textAlign = "center";
    sctx.textBaseline = "middle";
    sctx.fillStyle = "#fff";
    sctx.fillText(ch, S / 2, S / 2);
    const px = sctx.getImageData(0, 0, S, S).data;
    let minX = S, maxX = -1;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (px[(y * S + x) * 4 + 3] > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }
    _gGlyphDxCache[ch] = maxX < 0 ? 0 : S / 2 - (minX + maxX + 1) / 2;
  }
  return _gGlyphDxCache[ch];
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

function _gMakeStreetSprite(forcePerson) {
  const W       = _gCanvas.width;
  const goRight = Math.random() < 0.5;
  const roll    = forcePerson ? 0 : Math.random();
  let type, vx, rows, colors, shirtIdx;

  if (roll < 0.72) {
    // Person walking — pedestrians dominate the street
    type     = "person";
    vx       = (0.5 + Math.random() * 0.4) * (goRight ? 1 : -1);
    rows     = null; // chosen at draw time from _WALK_FRAMES
    shirtIdx = Math.floor(Math.random() * _WALK_SHIRTS.length);
    colors   = Object.assign({ B: _WALK_SHIRTS[shirtIdx] }, _WALK_BASE);
  } else if (roll < 0.92) {
    // Motorbike — sometimes a green Grab driver
    type   = "moto";
    vx     = (1.5 + Math.random() * 1.2) * (goRight ? 1 : -1);
    rows   = _MOTO_ROWS;
    colors = Math.random() < 0.35 ? _MOTO_GRAB_COL : _MOTO_COL;
  } else {
    // Baht bus (songthaew) — rarer
    type   = "bus";
    vx     = (0.7 + Math.random() * 0.6) * (goRight ? 1 : -1);
    rows   = _BUS_ROWS;
    colors = _BUS_COL;
  }

  const sprW = (rows || _WALK_FRAMES[0])[0].length * _SPR;
  return {
    type, vx, rows, colors,
    x: goRight ? -sprW - 10 : W + 10,
    knocked: false, dy: 0, vy: 0, rot: 0, rotV: 0,
  };
}

function _gSpawnStreetSprite(now) {
  _gStreetSprites.push(_gMakeStreetSprite(false));
  _gLastStreetSpawn = now;
  _gNextStreetIn    = 500 + Math.random() * 1500;
}

function _gDrawStreet(ctx, W, H) {
  const groundY = H * 0.82;

  // Moving sprites — feet at groundY
  for (const s of _gStreetSprites) {
    const flipX = s.vx < 0;
    const rows  = s.type === "person" ? _WALK_FRAMES[Math.floor(_gTime / 360) % 2] : s.rows;
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
  if (!_GAME_ALL.some((l, i) => i < _gPool && l.key === k)) return false;

  // Target the lowest matching bubble (most urgent)
  let target = null;
  for (const b of _gBubbles) {
    if (!b.popped && b.letter.key === k && (!target || b.y > target.y)) target = b;
  }

  if (target) {
    _gPopBubble(target);
  } else {
    // Valid key but no matching bubble — shake everything
    _audio.sfx("wrong");
    for (const b of _gBubbles) { if (!b.popped) b.wrongFlash = 6; }
  }
  return true;
}

function _gPopBubble(target) {
  _gResolve(target);
  _audio.sfx("pop");
  _gPopParticles(target.x, target.y, target.color);
  target.popped = true;
  _gScore += 10 * _gLevel;
  _gPopped++;

  // Every 5 pops: schedule a random consonant for hint removal
  if (_gPopped % 5 === 0) {
    const eligible = _GAME_ALL.map((_, i) => i)
      .filter(i => i < _gPool && _gHintMode[i] === 0);
    if (eligible.length > 0) {
      _gHintMode[eligible[Math.floor(Math.random() * eligible.length)]] = 1;
    }
  }

  // Every 10 pops: level up — faster, and one new consonant joins the pool
  if (_gPopped % 10 === 0) {
    _gLevel++;
    _audio.sfx("levelup");
    _gSpawnMs = Math.max(650, _gSpawnMs - 250);
    _gSpeed   = Math.min(3.2, _gSpeed + 0.22);
    if (_gPool < _GAME_ALL.length) {
      _gPool++;
      _buildGameRef();               // desktop strip gains the new card
      if (IS_MOBILE) _gStyleKbd();   // its key lights up on the keyboard
    }
  }

  _gHUD();
}

// Touch input: on mobile the game shows the tutor's Kedmanee keyboard
// (built via _tBuildKbdInto from tutor.js). Tapping the key of a falling
// consonant pops it — same rules as typing it on desktop. Every tapped key
// is pronounced, right or wrong.
function _gBuildKbd() {
  _tBuildKbdInto(document.getElementById("game-kbd"), _gKbdPress);
  _gStyleKbd();
}

// (Re)apply key styling for the current pool: playable keys glow in their
// bubble's neon colour, locked/unused keys are subdued. Called again whenever
// a night unlocks a new consonant, so its key lights up mid-game.
function _gStyleKbd() {
  const keyToIdx = Object.fromEntries(
    _GAME_ALL.slice(0, _gPool).map((l, i) => [l.key, i])
  );
  document.querySelectorAll("#game-kbd .tkey").forEach(el => {
    const idx = keyToIdx[el.dataset.key];
    const th  = el.querySelector(".tkey-th");
    if (idx === undefined) {
      el.classList.add("dim");
      th.style.color = ""; th.style.textShadow = ""; el.style.borderColor = "";
      return;
    }
    el.classList.remove("dim");
    const c = _NEON[idx];
    th.style.color       = c;
    th.style.textShadow  = `0 0 8px ${c}`;
    el.style.borderColor = c + "70";
  });
}

function _gKbdPress(key) {
  const entry = TUTOR_ALL.find(e => e.key === key);
  if (entry) _tts.speak(letterSpeechParts(entry.thai));
  const idx = _GAME_ALL.findIndex((l, i) => i < _gPool && l.key === key);
  if (idx === -1) return; // locked/unused key: pronunciation only
  _gKeyIdx(idx);
}

function _gKeyIdx(idx) {
  if (!_gRunning) return;

  let target = null;
  for (const b of _gBubbles) {
    if (!b.popped && b.letterIdx === idx && (!target || b.y > target.y)) target = b;
  }

  if (target) {
    _gPopBubble(target);
  } else {
    // Wrong key — shake the bubbles and flash the tapped key
    _audio.sfx("wrong");
    for (const b of _gBubbles) { if (!b.popped) b.wrongFlash = 6; }
    const el = document.querySelector(`#game-kbd .tkey[data-key="${_GAME_ALL[idx].key}"]`);
    if (el) {
      el.classList.add("t-wrong");
      setTimeout(() => el.classList.remove("t-wrong"), 350);
    }
  }
}

// ── Reference strip ────────────────────────────────────────────────────────

function _buildGameRef() {
  const ref = document.getElementById("game-ref");
  ref.innerHTML = "";
  for (let i = 0; i < _gPool; i++) {
    const l   = _GAME_ALL[i];
    const c   = _NEON[i];
    const div = document.createElement("div");
    div.className = "game-ref-card";
    div.id        = "game-ref-" + i;
    div.style.borderColor = c + "70";
    div.innerHTML =
      `<span class="game-ref-thai" style="color:${c};text-shadow:0 0 8px ${c}">${l.thai}</span>` +
      `<span class="game-ref-key" id="game-ref-key-${i}" style="color:${c}bb">${l.key}</span>`;
    ref.appendChild(div);
    // Rebuilt mid-game when a night unlocks a letter — keep removed hints dim
    if (_gHintMode[i] === 2) _gDimRefCard(i);
  }
}

// Dim a reference card's key label when that hint is permanently removed
function _gDimRefCard(idx) {
  const el = document.getElementById("game-ref-key-" + idx);
  if (!el) return;
  el.style.opacity        = "0.18";
  el.style.textDecoration = "line-through";
}
