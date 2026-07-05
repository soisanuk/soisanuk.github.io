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
];

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

// ── Public entry ───────────────────────────────────────────────────────────

function startTutor() {
  showScreen("tutor-screen", "K");
  _tActive  = true;
  _tStreak  = 0;
  _tCorrect = 0;
  _tTotal   = 0;
  _tCurrent = null;
  _tPrev    = null;
  _tBuildKbd();
  _tApplyDim();
  _tNext();
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
  let pick, tries = 0;
  do { pick = pool[Math.floor(Math.random() * pool.length)]; }
  while (pick === _tCurrent && pool.length > 1 && ++tries < 10);
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
  document.querySelector(`.tkey[data-key="${_tCurrent.key}"]`)?.classList.add('t-target');
  _tUpdateStats();
}

function _tUpdateStats() {
  document.getElementById('t-streak').textContent = _tStreak;
  document.getElementById('t-acc').textContent    =
    _tTotal > 0 ? Math.round(_tCorrect / _tTotal * 100) + '%' : '—';
}

// ── Input handler (called from main.js keydown) ────────────────────────────

function _tType(eKey) {
  if (!_tActive || !_tCurrent || _tFlashId) return false;
  // Normalise: A-Z → a-z; punctuation kept as-is
  const k = eKey.length === 1 && eKey >= 'A' && eKey <= 'Z' ? eKey.toLowerCase() : eKey;
  if (!TUTOR_ALL.some(e => e.key === k)) return false;

  _tTotal++;
  _tts.speak(letterSpeechParts(_tCurrent.thai));
  if (k === _tCurrent.key) {
    _tCorrect++;
    _tStreak++;
    document.querySelector('.tkey.t-target')?.classList.replace('t-target', 't-ok');
    _tUpdateStats();
    _tFlashId = setTimeout(_tNext, 700);
  } else {
    _tStreak = 0;
    _tUpdateStats();
    const wrongEl   = document.querySelector(`.tkey[data-key="${k}"]`);
    const correctEl = document.querySelector(`.tkey[data-key="${_tCurrent.key}"]`);
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
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l',';'],
  ['z','x','c','v','b','n','m',',','.'],
];

// Generic Kedmanee keyboard builder — also used by the Walking Street game
// on mobile. onKey receives the Latin key of the tapped .tkey.
function _tBuildKbdInto(container, onKey) {
  if (container.childElementCount > 0) return; // already built
  const byKey = Object.fromEntries(TUTOR_ALL.map(k => [k.key, k]));
  for (const row of _T_ROWS) {
    const rowEl = document.createElement('div');
    rowEl.className = 't-row';
    for (const k of row) {
      const entry = byKey[k];
      const el = document.createElement('div');
      el.className = 'tkey';
      el.dataset.key = k;
      el.innerHTML =
        `<span class="tkey-lat">${k}</span>` +
        `<span class="tkey-th">${entry ? entry.thai : ''}</span>`;
      el.addEventListener('click', () => onKey(k));
      rowEl.appendChild(el);
    }
    container.appendChild(rowEl);
  }
}

function _tBuildKbd() {
  _tBuildKbdInto(document.getElementById('t-kbd'), _tType);
}

function _tApplyDim() {
  const active = new Set(_tPool().map(k => k.key));
  document.querySelectorAll('.tkey').forEach(el =>
    el.classList.toggle('dim', !active.has(el.dataset.key))
  );
}
