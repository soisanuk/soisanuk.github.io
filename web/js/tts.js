// Thai text-to-speech via the Web Speech API.

// ─── text-to-speech ───────────────────────────────────────────────────────────
const _tts = (() => {
  let _voice = null;
  let _ready = false;

  function _findVoice() {
    const voices = speechSynthesis.getVoices();
    // Chrome loads voices async: an empty list means "not loaded yet",
    // so don't declare readiness (and show no warning) until we've seen
    // a real list or the timeout below fires.
    if (voices.length) _ready = true;
    _voice = voices.find(v => v.lang === "th-TH") ||
             voices.find(v => v.lang.startsWith("th")) ||
             null;
    _updateVoiceNotice();
  }

  if (typeof speechSynthesis !== "undefined") {
    _findVoice();
    speechSynthesis.addEventListener("voiceschanged", _findVoice);
  }
  // Fallback: if no voice list ever arrives, treat TTS as unavailable
  setTimeout(() => { _ready = true; _updateVoiceNotice(); }, 2000);

  return {
    ready() { return _ready; },
    available() { return _ready && !!_voice; },
    speak(text, btn) {
      if (!_voice) return;
      speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.voice = _voice;
      utt.lang  = "th-TH";
      utt.rate  = 0.85;
      if (btn) {
        btn.classList.add("speaking");
        utt.onend = utt.onerror = () => btn.classList.remove("speaking");
      }
      // Chrome requires a short delay after cancel() before speak() works reliably
      setTimeout(() => speechSynthesis.speak(utt), 50);
    },
  };
})();

// Shown on the home screen when the device has no Thai TTS voice, so the
// audio features don't just silently do nothing.
function _updateVoiceNotice() {
  const el = document.getElementById("voice-notice");
  if (!el) return;
  el.style.display = _tts.ready() && !_tts.available() ? "" : "none";
}

function _flashSpeakSet(text) {
  const btn = document.getElementById("flash-speak-btn");
  if (!btn || !_tts.available()) return;
  if (!text) { btn.style.display = "none"; return; }
  btn.style.display = "";
  btn.onclick = () => _tts.speak(text, btn);
}
