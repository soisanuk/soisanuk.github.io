// Chiptune sound effects + background music for the games, synthesised live
// with the Web Audio API — no audio files, works offline and from file://.
//
// The AudioContext is created lazily on the first sfx/music call, which always
// happens inside a user gesture (starting a game / pressing a key), satisfying
// autoplay policies on Chrome and iOS. Music volume is kept low so it never
// fights the TTS voice the games speak over it.

const _audio = (() => {
  let _actx = null, _sfxBus = null, _musBus = null, _noiseBuf = null;
  let _muted = false;
  try { _muted = localStorage.getItem("thaicab_muted") === "1"; } catch (e) {}

  const SFX_VOL = 0.5, MUS_VOL = 0.16;

  function _ctx() {
    if (_actx) {
      if (_actx.state === "suspended") _actx.resume();
      return _actx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    _actx = new AC();
    _sfxBus = _actx.createGain();
    _musBus = _actx.createGain();
    _sfxBus.connect(_actx.destination);
    _musBus.connect(_actx.destination);
    _applyMute();
    return _actx;
  }

  function _applyMute() {
    if (!_actx) return;
    _sfxBus.gain.value = _muted ? 0 : SFX_VOL;
    _musBus.gain.value = _muted ? 0 : MUS_VOL;
  }

  // One enveloped oscillator note. glideTo bends the pitch across the note.
  function _note(freq, t0, dur, type, vol, bus, glideTo) {
    const o = _actx.createOscillator();
    const g = _actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(bus);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  // Filtered white-noise burst (hi-hats, thunks)
  function _noise(t0, dur, vol, bus, cutoff) {
    if (!_noiseBuf) {
      _noiseBuf = _actx.createBuffer(1, _actx.sampleRate * 0.2, _actx.sampleRate);
      const d = _noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = _actx.createBufferSource();
    s.buffer = _noiseBuf;
    const f = _actx.createBiquadFilter();
    f.type = cutoff > 2000 ? "highpass" : "lowpass";
    f.frequency.value = cutoff;
    const g = _actx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(f);
    f.connect(g);
    g.connect(bus);
    s.start(t0);
    s.stop(t0 + dur + 0.02);
  }

  const _f = midi => 440 * Math.pow(2, (midi - 69) / 12);

  // ── Sound effects ─────────────────────────────────────────────────────────
  const SFX = {
    pop:      t => _note(660, t, 0.09, "square", 0.30, _sfxBus, 1320),
    wrong:    t => _note(150, t, 0.18, "sawtooth", 0.22, _sfxBus, 110),
    miss:     t => _note(420, t, 0.35, "triangle", 0.30, _sfxBus, 70),
    bounce:   t => _note(180, t, 0.16, "sine", 0.30, _sfxBus, 420),
    levelup:  t => [523, 659, 784, 1047].forEach((f, i) => _note(f, t + i * 0.09, 0.12, "square", 0.20, _sfxBus)),
    gameover: t => [392, 330, 262, 196].forEach((f, i) => _note(f, t + i * 0.16, 0.22, "triangle", 0.26, _sfxBus)),
    good:     t => [784, 1175].forEach((f, i) => _note(f, t + i * 0.10, 0.16, "triangle", 0.26, _sfxBus)),
    bad:      t => _note(220, t, 0.25, "sine", 0.24, _sfxBus, 140),
    drop:     t => { _note(700, t, 0.12, "triangle", 0.26, _sfxBus, 180); _noise(t + 0.10, 0.05, 0.28, _sfxBus, 500); },
    win:      t => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => _note(f, t + i * 0.11, 0.15, "square", 0.18, _sfxBus)),
    lose:     t => [330, 311, 294, 262].forEach((f, i) => _note(f, t + i * 0.20, 0.26, "triangle", 0.24, _sfxBus)),
    coin:     t => { _note(1568, t, 0.06, "square", 0.20, _sfxBus); _note(2093, t + 0.05, 0.09, "square", 0.18, _sfxBus); },
    cash:     t => { _noise(t, 0.05, 0.22, _sfxBus, 3500); _note(988, t + 0.02, 0.08, "square", 0.20, _sfxBus); _note(1319, t + 0.10, 0.16, "square", 0.20, _sfxBus); },
  };

  // ── Background music ──────────────────────────────────────────────────────
  // Step sequencer: 8th-note steps, one chord per bar (8 steps), 4-bar loop.
  // bass = MIDI roots per bar; prog = arpeggio chord tones per bar.
  const TRACKS = {
    // Walking Street — driving synthwave, A minor (Am F G Em)
    street: {
      bpm: 126, lead: "square", leadVol: 0.14, hat: true, bassEvery: 1,
      bass: [33, 29, 31, 28],
      prog: [[69, 72, 76], [65, 69, 72], [67, 71, 74], [64, 67, 71]],
    },
    // Soi Buakhao — laid-back lounge, major sevenths (Cmaj7 Am7 Fmaj7 G7)
    soi: {
      bpm: 88, lead: "triangle", leadVol: 0.16, hat: false, bassEvery: 2,
      bass: [36, 33, 29, 31],
      prog: [[72, 76, 79, 83], [69, 72, 76, 79], [65, 69, 72, 76], [67, 71, 74, 77]],
    },
    // Soi 6 — slinky D-minor groove (Dm Bb Gm A7)
    soi6: {
      bpm: 104, lead: "square", leadVol: 0.12, hat: true, bassEvery: 2,
      bass: [38, 34, 31, 33],
      prog: [[74, 77, 81], [70, 74, 77], [67, 70, 74], [69, 73, 76]],
    },
    // Baht Bus — easy luk-thung roll for the sunset loop (C Am F G, pentatonic lean)
    bus: {
      bpm: 112, lead: "triangle", leadVol: 0.15, hat: true, bassEvery: 2,
      bass: [36, 33, 29, 31],
      prog: [[72, 74, 76, 79], [69, 72, 74, 76], [65, 67, 69, 72], [67, 71, 74, 79]],
    },
  };

  let _track = null, _trackName = null, _step = 0, _nextT = 0, _timer = null;

  function _schedule() {
    while (_nextT < _actx.currentTime + 0.18) {
      const t = _track, spb = 30 / t.bpm; // 8th-note duration
      const bar = Math.floor(_step / 8) % t.bass.length;
      const pos = _step % 8;
      const root = t.bass[bar];
      if (pos % t.bassEvery === 0) {
        _note(_f(pos % 4 === 2 ? root + 12 : root), _nextT, spb * 0.9, "triangle", 0.45, _musBus);
      }
      const chord = t.prog[bar];
      _note(_f(chord[_step % chord.length]), _nextT, spb * 0.8, t.lead, t.leadVol, _musBus);
      if (t.hat && pos % 2 === 1) _noise(_nextT, 0.03, 0.10, _musBus, 7000);
      _step++;
      _nextT += spb;
    }
  }

  function _musicStop() {
    if (_timer) { clearInterval(_timer); _timer = null; }
    _track = _trackName = null;
  }

  return {
    sfx(name) {
      if (_muted || !SFX[name] || !_ctx()) return;
      SFX[name](_actx.currentTime);
    },
    music(name) {
      if (!TRACKS[name] || !_ctx()) return;
      if (_trackName === name && _timer) return; // already playing
      _musicStop();
      _track = TRACKS[name];
      _trackName = name;
      _step = 0;
      _nextT = _actx.currentTime + 0.05;
      _timer = setInterval(_schedule, 60);
    },
    stop: _musicStop,
    muted() { return _muted; },
    toggleMute() {
      _muted = !_muted;
      try { localStorage.setItem("thaicab_muted", _muted ? "1" : "0"); } catch (e) {}
      _applyMute();
      return _muted;
    },
  };
})();

// Screen → music track. Called by showScreen, so entering a game starts its
// loop and navigating anywhere else stops it.
function _audioScreen(id) {
  const track = { "game-screen": "street", "soi-screen": "soi", "c4-screen": "soi6", "bb-screen": "bus" }[id];
  if (track) _audio.music(track);
  else _audio.stop();
}
