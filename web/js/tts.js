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

  return {
    ready() { return _ready || !!_capTTS(); },
    available() { return (_ready && !!_voice) || !!_capTTS(); },
    speak(text, btn) {
      const cap = _capTTS();
      if (cap) {
        if (btn) btn.classList.add("speaking");
        cap.stop().catch(() => {});
        cap.speak({ text, lang: "th-TH", rate: 0.85 })
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
      const utt = new SpeechSynthesisUtterance(text);
      utt.voice = voice;
      utt.lang  = "th-TH";
      utt.rate  = 0.85;
      if (btn) {
        btn.classList.add("speaking");
        utt.onend = utt.onerror = () => btn.classList.remove("speaking");
      }
      // Chrome requires a short delay after cancel() before speak() works
      // reliably — but on iOS the delay pushes speak() out of the user-gesture
      // call stack and the utterance is silently dropped, so speak directly.
      if (typeof IS_IOS !== "undefined" && IS_IOS) {
        speechSynthesis.speak(utt);
      } else {
        setTimeout(() => speechSynthesis.speak(utt), 50);
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
