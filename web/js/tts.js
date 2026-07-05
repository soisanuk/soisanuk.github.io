// Thai text-to-speech via the Web Speech API.

// ─── text-to-speech ───────────────────────────────────────────────────────────
const _tts = (() => {
  let _voice = null;
  let _ready = false;

  // Native TTS when packaged with Capacitor. Android's System WebView has no
  // speechSynthesis at all, so the @capacitor-community/text-to-speech plugin
  // is the only audio path there. Absent (plain browser), this is null.
  const _capTTS = () =>
    (typeof window !== "undefined" && window.Capacitor?.Plugins?.TextToSpeech) || null;

  // Uses local state directly — safe to call before _tts is assigned.
  function _applyNotice() {
    const el = document.getElementById("voice-notice");
    if (!el) return;
    el.style.display = _ready && !_voice && !_capTTS() ? "" : "none";
  }

  function _findVoice() {
    const voices = speechSynthesis.getVoices();
    // Chrome loads voices async: an empty list means "not loaded yet",
    // so don't declare readiness (and show no warning) until we've seen
    // a real list or the timeout below fires.
    if (voices.length) _ready = true;
    _voice = voices.find(v => v.lang === "th-TH") ||
             voices.find(v => v.lang.startsWith("th")) ||
             null;
    _applyNotice();
  }

  if (typeof speechSynthesis !== "undefined") {
    _findVoice();
    speechSynthesis.addEventListener("voiceschanged", _findVoice);
  }
  // Fallback: if no voice list ever arrives, treat TTS as unavailable
  setTimeout(() => { _ready = true; _applyNotice(); }, 2000);

  // iOS refuses to speak until speechSynthesis is first used inside a user
  // gesture. Fire a silent utterance on the first touch to unlock it.
  if (typeof IS_IOS !== "undefined" && IS_IOS && typeof speechSynthesis !== "undefined") {
    const unlock = () => {
      const utt = new SpeechSynthesisUtterance("");
      utt.volume = 0;
      speechSynthesis.speak(utt);
      document.removeEventListener("touchend", unlock);
      document.removeEventListener("click", unlock);
    };
    document.addEventListener("touchend", unlock);
    document.addEventListener("click", unlock);
  }

  // Pause between the parts of a multi-part utterance (letter sound → name).
  const _GAP = 400;
  // Generation counter: a new speak() invalidates any pending chained parts
  // from the previous one (cancel() alone can't stop a queued setTimeout).
  let _gen = 0;

  return {
    ready() { return _ready || !!_capTTS(); },
    available() { return (_ready && !!_voice) || !!_capTTS(); },
    // text may be a string or an array of parts. Parts are spoken as
    // separate utterances with a real pause between them — a comma inside
    // one utterance is read straight through by Thai voices, flattening
    // "ก, ก ไก่" into three even syllables.
    speak(text, btn) {
      const parts = (Array.isArray(text) ? text : [text]).filter(Boolean);
      if (!parts.length) return;
      const gen = ++_gen;
      const cap = _capTTS();
      if (cap) {
        if (btn) btn.classList.add("speaking");
        cap.stop().catch(() => {});
        (async () => {
          for (let i = 0; i < parts.length; i++) {
            if (gen !== _gen) return;
            if (i) await new Promise(r => setTimeout(r, _GAP));
            if (gen !== _gen) return;
            await cap.speak({ text: parts[i], lang: "th-TH", rate: 0.85 });
          }
        })()
          .catch(() => {})
          .finally(() => { if (btn) btn.classList.remove("speaking"); });
        return;
      }
      if (!_voice) return;
      // Re-fetch voices each call: Chrome's cached voice reference goes stale
      // after the first utterance, causing silent playback.
      const voices = speechSynthesis.getVoices();
      const voice = voices.find(v => v.lang === "th-TH") ||
                    voices.find(v => v.lang.startsWith("th")) ||
                    _voice;
      // resume() before cancel() in case Chrome left synthesis paused.
      speechSynthesis.resume();
      speechSynthesis.cancel();
      const utts = parts.map(p => {
        const u = new SpeechSynthesisUtterance(p);
        u.voice = voice;
        u.lang  = "th-TH";
        u.rate  = 0.85;
        return u;
      });
      const last = utts[utts.length - 1];
      if (btn) {
        btn.classList.add("speaking");
        last.onend = last.onerror = () => btn.classList.remove("speaking");
      }
      // Chrome requires a short delay after cancel() before speak() works
      // reliably — but on iOS the delay pushes speak() out of the user-gesture
      // call stack and the utterance is silently dropped, so all parts are
      // queued directly there (the utterance boundary still gives a pause).
      if (typeof IS_IOS !== "undefined" && IS_IOS) {
        utts.forEach(u => speechSynthesis.speak(u));
      } else {
        for (let i = 0; i < utts.length - 1; i++) {
          const next = utts[i + 1];
          utts[i].onend = () => setTimeout(() => {
            if (gen === _gen) speechSynthesis.speak(next);
          }, _GAP);
          utts[i].onerror = () => { if (btn) btn.classList.remove("speaking"); };
        }
        setTimeout(() => { if (gen === _gen) speechSynthesis.speak(utts[0]); }, 50);
      }
    },
  };
})();

function _flashSpeakSet(text) {
  const btn = document.getElementById("flash-speak-btn");
  if (!btn || !_tts.available()) return;
  if (!text) { btn.style.display = "none"; return; }
  btn.style.display = "";
  btn.onclick = () => _tts.speak(text, btn);
}
