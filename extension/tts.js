// Speech for the extension.
//
// The app's web/js/tts.js touches the DOM at load and is wired to the
// trainer's mute button and settings, none of which exist here. wordcard.js
// calls _tts.available() and _tts.speak() WITHOUT guarding — unlike EXAMPLES
// and WORD_MAP, which it checks for — so this is not optional: without it the
// card throws the moment it renders a speak button.
const _tts = {
  _voice: undefined,

  voice() {
    if (this._voice !== undefined) return this._voice;
    if (typeof speechSynthesis === "undefined") return (this._voice = null);
    const vs = speechSynthesis.getVoices() || [];
    this._voice = vs.find(v => /^th(-|_|$)/i.test(v.lang)) || null;
    return this._voice;
  },

  // Voices load asynchronously in Chrome: getVoices() is empty on first call
  // and fills in later, so a cached "no voice" answer from page load would be
  // wrong for the rest of the session.
  refresh() { this._voice = undefined; return this.voice(); },

  available() { return !!this.voice(); },

  speak(text, btn) {
    if (!text || typeof speechSynthesis === "undefined") return;
    const v = this.voice();
    if (!v) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      u.voice = v;
      u.lang = v.lang;
      u.rate = 0.85;
      if (btn) {
        btn.classList.add("speaking");
        u.onend = u.onerror = () => btn.classList.remove("speaking");
      }
      speechSynthesis.speak(u);
    } catch (e) { /* a page may have its own speechSynthesis quirks; never throw at the card */ }
  },
};

if (typeof speechSynthesis !== "undefined" && "onvoiceschanged" in speechSynthesis) {
  speechSynthesis.onvoiceschanged = () => _tts.refresh();
}
