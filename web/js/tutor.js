// Thai Keyboard Typing Tutor — คีย์บอร์ดไทย
// Teaches the Kedmanee layout: type the correct key for each Thai character.

const TUTOR_ALL = [
  { key:'q', thai:'ๆ', name:'Mai Yamok',     cat:'other'     },
  { key:'w', thai:'ไ', name:'mai malai',      cat:'vowel'     },
  { key:'e', thai:'ำ', name:'sara am',        cat:'vowel'     },
  { key:'r', thai:'พ', name:'Pho Phan',       cat:'consonant' },
  { key:'t', thai:'ะ', name:'sara a',         cat:'vowel'     },
  { key:'y', thai:'ั', name:'mai han akat',   cat:'vowel'     },
  { key:'u', thai:'ี', name:'sara ii',        cat:'vowel'     },
  { key:'i', thai:'ร', name:'Ro Rua',         cat:'consonant' },
  { key:'o', thai:'น', name:'No Nu',          cat:'consonant' },
  { key:'p', thai:'ย', name:'Yo Yak',         cat:'consonant' },
  { key:'a', thai:'ฟ', name:'Fo Fa',          cat:'consonant' },
  { key:'s', thai:'ห', name:'Ho Hip',         cat:'consonant' },
  { key:'d', thai:'ก', name:'Ko Kai',         cat:'consonant' },
  { key:'f', thai:'ด', name:'Do Dek',         cat:'consonant' },
  { key:'g', thai:'เ', name:'sara e',         cat:'vowel'     },
  { key:'h', thai:'้', name:'mai tho',        cat:'tone'      },
  { key:'j', thai:'่', name:'mai ek',         cat:'tone'      },
  { key:'k', thai:'า', name:'sara aa',        cat:'vowel'     },
  { key:'l', thai:'ส', name:'So Suea',        cat:'consonant' },
  { key:';', thai:'ว', name:'Wo Waen',        cat:'consonant' },
  { key:'z', thai:'ผ', name:'Pho Phueng',     cat:'consonant' },
  { key:'x', thai:'ป', name:'Po Pla',         cat:'consonant' },
  { key:'c', thai:'แ', name:'sara ae',        cat:'vowel'     },
  { key:'v', thai:'อ', name:'Ao',             cat:'consonant' },
  { key:'b', thai:'ิ', name:'sara i',         cat:'vowel'     },
  { key:'n', thai:'ื', name:'sara ue',        cat:'vowel'     },
  { key:'m', thai:'ท', name:'Tho Thahan',     cat:'consonant' },
  { key:',', thai:'ม', name:'Mo Ma',          cat:'consonant' },
  { key:'.', thai:'ใ', name:'mai noi',        cat:'vowel'     },
  { key:'[', thai:'บ', name:'Bo Baimai',      cat:'consonant' },
  { key:']', thai:'ล', name:'Lo Ling',        cat:'consonant' },
  { key:"'", thai:'ง', name:'Ngo Ngu',        cat:'consonant' },
  { key:'/', thai:'ฝ', name:'Fo Fa',          cat:'consonant' },
  // The number row. Without it ค ต จ ข ช were on no key at all, so ครับ, คน,
  // ตอบ and ข้าว could not be typed — and the course's typed-Thai card was
  // asking for words containing them. 2 and 3 carry / and _ on a real
  // Kedmanee board: rendered blank here, because they are not Thai.
  { key:'1', thai:'ๅ', name:'lakkhangyao',    cat:'vowel'     },
  { key:'4', thai:'ภ', name:'Pho Samphao',    cat:'consonant' },
  { key:'5', thai:'ถ', name:'Tho Thung',      cat:'consonant' },
  { key:'6', thai:'ุ', name:'sara u',         cat:'vowel'     },
  { key:'7', thai:'ึ', name:'sara ue',        cat:'vowel'     },
  { key:'8', thai:'ค', name:'Kho Khwai',      cat:'consonant' },
  { key:'9', thai:'ต', name:'To Tao',         cat:'consonant' },
  { key:'0', thai:'จ', name:'Cho Chan',       cat:'consonant' },
  { key:'-', thai:'ข', name:'Kho Khai',       cat:'consonant' },
  { key:'=', thai:'ช', name:'Cho Chang',      cat:'consonant' },

  // ── The shifted layer (TIS 820-2538) ────────────────────────────────────
  // `shift: true` with the BASE key, not the character Shift produces: a
  // physical event gives "C" or "^", which is a US-QWERTY fact, not a Thai
  // one — _tNormKey turns those back into {key, shift} so the mapping stays
  // about the Thai layout.
  //
  // Why this exists at all: ็ and ู are on this layer, and they sit in เป็น
  // and อยู่ — the two commonest verbs in the language. A course that cannot
  // ask you to type "to be" is not finished. Putting them on some spare
  // unshifted key instead would teach a finger position that does not exist,
  // which for a typing tutor is worse than omitting them.
  //
  // ASCII that Shift produces (+ " , . ( ) ? _ %) is deliberately absent —
  // this table is the Thai layer only.
  { key:'2', thai:'๑', name:'Thai digit one',   cat:'other', shift:true },
  { key:'3', thai:'๒', name:'Thai digit two',   cat:'other', shift:true },
  { key:'4', thai:'๓', name:'Thai digit three', cat:'other', shift:true },
  { key:'5', thai:'๔', name:'Thai digit four',  cat:'other', shift:true },
  { key:'6', thai:'ู', name:'sara uu',          cat:'vowel', shift:true },
  { key:'7', thai:'฿', name:'baht sign',        cat:'other', shift:true },
  { key:'8', thai:'๕', name:'Thai digit five',  cat:'other', shift:true },
  { key:'9', thai:'๖', name:'Thai digit six',   cat:'other', shift:true },
  { key:'0', thai:'๗', name:'Thai digit seven', cat:'other', shift:true },
  { key:'-', thai:'๘', name:'Thai digit eight', cat:'other', shift:true },
  { key:'=', thai:'๙', name:'Thai digit nine',  cat:'other', shift:true },
  { key:'q', thai:'๐', name:'Thai digit zero',  cat:'other', shift:true },
  { key:'e', thai:'ฎ', name:'Do Chada',      cat:'consonant', shift:true },
  { key:'r', thai:'ฑ', name:'Tho Nangmontho',cat:'consonant', shift:true },
  { key:'t', thai:'ธ', name:'Tho Thong',     cat:'consonant', shift:true },
  { key:'y', thai:'ํ', name:'nikhahit',      cat:'tone',      shift:true },
  { key:'u', thai:'๊', name:'mai tri',       cat:'tone',      shift:true },
  { key:'i', thai:'ณ', name:'No Nen',        cat:'consonant', shift:true },
  { key:'o', thai:'ฯ', name:'paiyannoi',     cat:'other',     shift:true },
  { key:'p', thai:'ญ', name:'Yo Ying',       cat:'consonant', shift:true },
  { key:'[', thai:'ฐ', name:'Tho Than',      cat:'consonant', shift:true },
  { key:'a', thai:'ฤ', name:'Ru',            cat:'vowel',     shift:true },
  { key:'s', thai:'ฆ', name:'Kho Rakhang',   cat:'consonant', shift:true },
  { key:'d', thai:'ฏ', name:'To Patak',      cat:'consonant', shift:true },
  { key:'f', thai:'โ', name:'sara o',        cat:'vowel',     shift:true },
  { key:'g', thai:'ฌ', name:'Cho Choe',      cat:'consonant', shift:true },
  { key:'h', thai:'็', name:'mai taikhu',    cat:'tone',      shift:true },
  { key:'j', thai:'๋', name:'mai chattawa',  cat:'tone',      shift:true },
  { key:'k', thai:'ษ', name:'So Rusi',       cat:'consonant', shift:true },
  { key:'l', thai:'ศ', name:'So Sala',       cat:'consonant', shift:true },
  { key:';', thai:'ซ', name:'So So',         cat:'consonant', shift:true },
  { key:'c', thai:'ฉ', name:'Cho Ching',     cat:'consonant', shift:true },
  { key:'v', thai:'ฮ', name:'Ho Nokhuk',     cat:'consonant', shift:true },
  { key:'b', thai:'ฺ', name:'phinthu',       cat:'tone',      shift:true },
  { key:'n', thai:'์', name:'thanthakhat',   cat:'tone',      shift:true },
  { key:',', thai:'ฒ', name:'Tho Phuthao',   cat:'consonant', shift:true },
  { key:'.', thai:'ฬ', name:'Lo Chula',      cat:'consonant', shift:true },
  { key:'/', thai:'ฦ', name:'Lu',            cat:'vowel',     shift:true },
];

// What a physical key event means on this layout. Shift+c arrives as "C" and
// Shift+6 as "^" — both US-QWERTY facts about the machine, not about Thai —
// so they are folded back to the base key plus a shift flag. The old code
// lowercased A-Z outright, which made Shift+p indistinguishable from p.
const _T_SHIFTED_ASCII = {
  '!':'1','@':'2','#':'3','$':'4','%':'5','^':'6','&':'7','*':'8','(':'9',')':'0',
  '_':'-','+':'=','{':'[','}':']',':':';','"':"'",'<':',','>':'.','?':'/','~':'`',
};
function _tNormKey(eKey) {
  if (typeof eKey !== 'string' || eKey.length !== 1) return null;
  if (eKey >= 'A' && eKey <= 'Z') return { key: eKey.toLowerCase(), shift: true };
  if (_T_SHIFTED_ASCII[eKey]) return { key: _T_SHIFTED_ASCII[eKey], shift: true };
  return { key: eKey, shift: false };
}

// KeyboardEvent.code -> the base key, by PHYSICAL POSITION. This table is what
// the layout actually means: "Shift+h types ็" is a claim about the key where
// h sits on a US board, not about the letter h.
//
// It matters because event.key reports the character the CURRENT input source
// produces. A learner who has installed the Thai input source — the one
// furthest along — presses that key and the browser says "็", not "H". Reading
// only event.key dropped their every keystroke in silence. Reading `code`
// works whatever input source is active, which is the whole point.
const _T_CODE = (() => {
  const m = {};
  'abcdefghijklmnopqrstuvwxyz'.split('').forEach(c => { m['Key' + c.toUpperCase()] = c; });
  '1234567890'.split('').forEach(d => { m['Digit' + d] = d; });
  Object.assign(m, { Minus:'-', Equal:'=', BracketLeft:'[', BracketRight:']',
    Semicolon:';', Quote:"'", Comma:',', Period:'.', Slash:'/', Backquote:'`' });
  return m;
})();

// Decode a real key event. Position first; the character it produced is the
// fallback, which also lets someone typing on a genuine Thai layout answer
// with the Thai character itself.
function _tNormEvent(e) {
  if (!e) return null;
  const base = e.code && _T_CODE[e.code];
  if (base) return { key: base, shift: !!e.shiftKey };
  const byChar = TUTOR_ALL.find(t => t.thai === e.key);
  if (byChar) return { key: byChar.key, shift: !!byChar.shift };
  return _tNormKey(e.key);
}

// The entry a (key, shift) pair produces, or null.
function _tEntry(key, shift) {
  return TUTOR_ALL.find(e => e.key === key && !!e.shift === !!shift) || null;
}

// Combining marks (diacritics) need a host consonant to display.
// Leading vowels (เแโใไ, U+0E40–0E44) render standalone and are excluded —
// prefixing a host would also put it on the wrong side of them.
function _tDisp(thai) {
  const c = thai.charCodeAt(0);
  const combining = c === 0x0E31 ||                 // mai han akat
                    (c >= 0x0E33 && c <= 0x0E3A) || // sara am..phinthu
                    (c >= 0x0E47 && c <= 0x0E4E);   // maitaikhu..yamakkan
  return combining ? 'ก' + thai : thai;
}

// ── State ──────────────────────────────────────────────────────────────────

let _tMode     = 'consonants';
let _tCurrent  = null;
let _tPrev     = null;
let _tStreak   = 0;
let _tCorrect  = 0;
let _tTotal    = 0;
let _tActive   = false;
let _tFlashId  = null;

// ── The store ──────────────────────────────────────────────────────────────
// The tutor used to keep its score in these module-level lets and nowhere
// else: quit, and your accuracy, streak and every key you kept fumbling were
// gone. It was the one practice mode in the app that wrote to nothing, which
// for the persona whose whole goal is "get better at typing" made it a toy.
const TUTOR_KEY = "soisanuk_tutor";

function _tLoadStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(TUTOR_KEY) || "{}");
    return { keys: raw.keys || {}, correct: raw.correct || 0, total: raw.total || 0,
             best: raw.best || 0, hint: raw.hint !== false };
  } catch { return { keys: {}, correct: 0, total: 0, best: 0, hint: true }; }
}
function _tSaveStore(st) {
  try { localStorage.setItem(TUTOR_KEY, JSON.stringify(st)); } catch (e) {}
}
let _tStore = null;   // loaded on entry, written on every answer

// Per-key history. `seen`/`wrong` are lifetime; a key you have never met is
// worth showing, and one you keep missing is worth showing more.
function _tKeyStat(store, key) {
  return (store && store.keys && store.keys[key]) || { seen: 0, wrong: 0 };
}

// Weight for the draw. Pure, so the adaptivity is testable rather than
// something you have to sit and watch.
function _tWeight(stat) {
  if (!stat.seen) return 4;                       // never practised
  return 1 + 6 * (stat.wrong / stat.seen);        // always missed → 7x
}

// Weighted pick, avoiding an immediate repeat. `rnd` is injectable so a test
// can pin the distribution instead of sampling it.
function _tPick(pool, store, prev, rnd) {
  if (!pool.length) return null;
  const cand = pool.length > 1 ? pool.filter(k => k !== prev) : pool;
  const ws = cand.map(k => _tWeight(_tKeyStat(store, _tKeyId(k))));
  const total = ws.reduce((a, b) => a + b, 0);
  let r = (rnd || Math.random)() * total;
  for (let i = 0; i < cand.length; i++) { r -= ws[i]; if (r <= 0) return cand[i]; }
  return cand[cand.length - 1];
}

// ── Public entry ───────────────────────────────────────────────────────────

function startTutor() {
  showScreen("tutor-screen", "K");
  _tStore   = _tLoadStore();
  _tActive  = true;
  _tStreak  = 0;
  _tCorrect = 0;
  _tTotal   = 0;
  _tCurrent = null;
  _tPrev    = null;
  _tBuildKbd();
  _tSyncHintBtn();
  _tApplyDim();
  _tNext();
}

// The hint is the target key glowing before you answer. With it on this is a
// guided tour — "press the pink one" — and Accuracy measures finding a
// highlight, not knowing the layout. It stays ON by default, because that is
// the right first five minutes; turning it off is what makes the screen a
// test. The preference persists, since a learner who has graduated should not
// have to graduate again every visit.
function _tToggleHint() {
  _tStore = _tStore || _tLoadStore();
  _tStore.hint = !_tStore.hint;
  _tSaveStore(_tStore);
  _tSyncHintBtn();
  _tRender();
}
function _tSyncHintBtn() {
  const b = document.getElementById("t-hint-btn");
  if (!b) return;
  const on = !_tStore || _tStore.hint !== false;
  b.textContent = on ? "Hint: on" : "Hint: off";
  b.classList.toggle("active", on);
  b.setAttribute("aria-pressed", String(on));
}

// ── Mode toggle ────────────────────────────────────────────────────────────

function _tSetMode(mode) {
  _tMode = mode;
  document.getElementById('t-mbtn-con').classList.toggle('active', mode === 'consonants');
  document.getElementById('t-mbtn-all').classList.toggle('active', mode === 'all');
  _tApplyDim();
  _tNext();
}

function _tPool() {
  return _tMode === 'consonants'
    ? TUTOR_ALL.filter(k => k.cat === 'consonant')
    : TUTOR_ALL;
}

// ── Challenge flow ─────────────────────────────────────────────────────────

function _tNext() {
  if (_tFlashId) { clearTimeout(_tFlashId); _tFlashId = null; }
  if (!document.getElementById('tutor-screen').classList.contains('active')) return;
  const pool = _tPool();
  const pick = _tPick(pool, _tStore, _tCurrent);
  _tPrev    = _tCurrent;
  _tCurrent = pick;
  _tRender();
}

function _tRender() {
  document.getElementById('t-char').textContent = _tDisp(_tCurrent.thai);
  document.getElementById('t-name').textContent = _tCurrent.name;
  _tts.speak(letterSpeechParts(_tCurrent.thai));
  document.querySelectorAll('.tkey').forEach(el =>
    el.classList.remove('t-target','t-ok','t-wrong','t-hint')
  );
  _tRenderFaces(document.getElementById('t-kbd'));
  if (!_tStore || _tStore.hint !== false) {
    // On the wrong layer the key is not showing, so highlighting it would
    // point at whatever else happens to be there. Point at Shift instead —
    // which is the actual next thing to press.
    if (!!_tCurrent.shift === _tShift) _tKeyEl(_tCurrent.key)?.classList.add('t-target');
    else document.querySelector('#t-kbd .tkey-shift')?.classList.add('t-target');
  }
  _tUpdateStats();
}

// Write the answer to the store, and tell the rest of the app that practice
// happened: every other mode feeds the day-streak through _streakRecord, and
// the tutor being the exception is why Records read "Biggest day: —" after a
// hundred answers.
// A key's identity for the store: "h" and "H" are different things to learn.
function _tKeyId(entry) { return (entry.shift ? 'S+' : '') + entry.key; }

// The element for a base key, whichever layer is showing.
function _tKeyEl(key) {
  return document.querySelector(`#tutor-screen .tkey[data-key="${CSS.escape(key)}"]`)
      || document.querySelector(`.tkey[data-key="${CSS.escape(key)}"]`);
}

function _tRecordKey(key, ok) {
  _tStore = _tStore || _tLoadStore();
  const st = _tStore.keys[key] || (_tStore.keys[key] = { seen: 0, wrong: 0 });
  st.seen++;
  if (!ok) st.wrong++;
  _tStore.total++;
  if (ok) _tStore.correct++;
  if (_tStreak + (ok ? 1 : 0) > _tStore.best) _tStore.best = _tStreak + (ok ? 1 : 0);
  _tSaveStore(_tStore);
  if (typeof _streakRecord === "function") _streakRecord(0);
}

function _tUpdateStats() {
  document.getElementById('t-streak').textContent = _tStreak;
  document.getElementById('t-acc').textContent    =
    _tTotal > 0 ? Math.round(_tCorrect / _tTotal * 100) + '%' : '—';
  // Lifetime, so there is something to come back to. Session accuracy alone
  // reset to "—" on every visit, which is what made the screen feel like it
  // had never met you before.
  const el = document.getElementById('t-life');
  if (el && _tStore) {
    el.textContent = _tStore.total
      ? `${Math.round(_tStore.correct / _tStore.total * 100)}% of ${_tStore.total} · best run ${_tStore.best}`
      : '';
  }
}

// ── Input handler (called from main.js keydown) ────────────────────────────

function _tType(eKey, shiftOverride) {
  if (!_tActive || !_tCurrent || _tFlashId) return false;
  // A tapped key already knows whether shift was held; a physical event has
  // to be decoded, because the browser hands over "C" or "^" rather than the
  // base key and a flag.
  const n = shiftOverride !== undefined ? { key: eKey, shift: !!shiftOverride }
          : (eKey && typeof eKey === 'object') ? _tNormEvent(eKey)
          : _tNormKey(eKey);
  if (!n || !_tEntry(n.key, n.shift)) return false;
  const k = n.key;
  const right = k === _tCurrent.key && n.shift === !!_tCurrent.shift;

  _tTotal++;
  _tRecordKey(_tKeyId(_tCurrent), right);
  if (right) {
    _tCorrect++;
    _tStreak++;
    // by data-key, not by .t-target: with the hint off nothing is marked
    // before the answer, so there is no t-target to promote.
    _tKeyEl(_tCurrent.key)?.classList.remove('t-target');
    _tKeyEl(_tCurrent.key)?.classList.add('t-ok');
    _tUpdateStats();
    _tFlashId = setTimeout(_tNext, 700);
  } else {
    _tStreak = 0;
    _tUpdateStats();
    const wrongEl   = _tKeyEl(k);
    const correctEl = _tKeyEl(_tCurrent.key);
    wrongEl?.classList.add('t-wrong');
    correctEl?.classList.remove('t-target');
    correctEl?.classList.add('t-hint');
    _tFlashId = setTimeout(() => {
      wrongEl?.classList.remove('t-wrong');
      correctEl?.classList.remove('t-hint');
      correctEl?.classList.add('t-target');
      _tFlashId = null;
    }, 700);
  }
  return true;
}

// ── Keyboard builder ───────────────────────────────────────────────────────

const _T_ROWS = [
  ['q','w','e','r','t','y','u','i','o','p','[',']'],
  ['a','s','d','f','g','h','j','k','l',';',"'"],
  ['z','x','c','v','b','n','m',',','.','/'],
];

// The tutor shows the number row; Walking Street and the course's typed-Thai
// card do not, because their keyboards sit under a game canvas and a lesson
// card and a fourth row costs height they do not have. Whatever a screen
// renders is the set it may ask for — see _tTypeable.
const _T_ROWS_FULL = [
  ['1','2','3','4','5','6','7','8','9','0','-','='],
  ..._T_ROWS,
];

// Which Thai characters a given set of rows can actually produce. The course
// asks the learner to TYPE a word, so it must not choose one this keyboard
// cannot spell: 138 of its 367 candidate targets (38%) needed a glyph on no
// rendered key — ดู, อยู่, ตื่น, รู้ — and the card simply could not be
// completed. Found by the 2026-09-01 typist round.
function _tTypeable(rows, withShift) {
  const on = new Set(rows.flat());
  return new Set(TUTOR_ALL
    .filter(k => on.has(k.key) && (withShift || !k.shift))
    .map(k => k.thai));
}

// Shift is a property of a built keyboard, not a global: the tutor and the
// course's typed-Thai card render it, Walking Street does not (its targets
// are single unshifted letters and its keyboard sits under a game canvas).
let _tShift = false;

// Generic Kedmanee keyboard builder — also used by the Walking Street game
// on mobile. onKey receives the Latin key of the tapped .tkey.
function _tBuildKbdInto(container, onKey, rows, withShift) {
  if (container.childElementCount > 0) return; // already built
  container.dataset.shiftable = withShift ? '1' : '';
  const rowList = rows || _T_ROWS;
  for (const row of rowList) {
    const rowEl = document.createElement('div');
    rowEl.className = 't-row';
    // Shift sits where it sits on a real board: left of the bottom letter row.
    if (withShift && row === rowList[rowList.length - 1]) {
      const sh = document.createElement('div');
      sh.className = 'tkey tkey-shift';
      sh.dataset.shiftkey = '1';
      sh.setAttribute('role', 'button');
      sh.setAttribute('aria-pressed', 'false');
      sh.setAttribute('aria-label', 'Shift');
      sh.innerHTML = '<span class="tkey-th">⇧</span>';
      sh.addEventListener('click', () => { _tShift = !_tShift; _tRenderFaces(container); });
      rowEl.appendChild(sh);
    }
    for (const k of row) {
      const entry = _tEntry(k, false);
      const el = document.createElement('div');
      el.className = 'tkey';
      el.dataset.key = k;
      // Tappable divs are invisible to assistive tech without this. Deliberately
      // NOT tabbable: physical typing is this screen's primary input, and 29
      // extra tab stops between the mode buttons and Quit would be a worse
      // keyboard experience than none.
      if (entry) {
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', `${entry.name} — key ${k}`);
      } else {
        el.setAttribute('aria-hidden', 'true');
      }
      el.innerHTML =
        `<span class="tkey-lat">${k}</span>` +
        `<span class="tkey-th" lang="th">${entry ? _tDisp(entry.thai) : ''}</span>`;
      el.addEventListener('click', () => onKey(k, _tShift));
      rowEl.appendChild(el);
    }
    container.appendChild(rowEl);
  }
  if (withShift) _tRenderFaces(container);
}

// Swap every key face between the two layers. The faces carry _tDisp output,
// so a combining mark shows on its ก host instead of as tofu.
function _tRenderFaces(container) {
  if (!container || !container.dataset.shiftable) return;
  const sh = container.querySelector('.tkey-shift');
  if (sh) { sh.classList.toggle('active', _tShift); sh.setAttribute('aria-pressed', String(_tShift)); }
  container.querySelectorAll('.tkey[data-key]').forEach(el => {
    const entry = _tEntry(el.dataset.key, _tShift);
    const face = el.querySelector('.tkey-th');
    if (face) face.textContent = entry ? _tDisp(entry.thai) : '';
    el.classList.toggle('t-blank', !entry);
    if (entry) el.setAttribute('aria-label', `${entry.name} — ${_tShift ? 'Shift+' : ''}${el.dataset.key}`);
  });
}

function _tBuildKbd() {
  _tBuildKbdInto(document.getElementById('t-kbd'), _tType, _T_ROWS_FULL, true);
}

function _tApplyDim() {
  const active = new Set(_tPool().filter(k => !!k.shift === _tShift).map(k => k.key));
  document.querySelectorAll('#t-kbd .tkey[data-key]').forEach(el =>
    el.classList.toggle('dim', !active.has(el.dataset.key))
  );
}
