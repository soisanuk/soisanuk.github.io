// Keyboard shortcuts and app init. Must be loaded last.

// ─── keyboard shortcuts ────────────────────────────────────────────────────
document.addEventListener("keydown", e => {
  const key = e.key;
  const active = document.querySelector(".screen.active")?.id;

  // Overlays swallow all keys and must be checked before any screen block —
  // the word modal can open over game screens (Soi Buakhao, Connect สี่).
  if (document.getElementById("tutorial-overlay").classList.contains("open")) {
    if (key === "Escape") closeTutorial();
    if (key === "ArrowRight") _tutNext();
    if (key === "ArrowLeft")  _tutPrev();
    return;
  }
  if (document.getElementById("wc-overlay").classList.contains("open")) {
    if (key === "Escape") {
      const layers = document.querySelectorAll("#wc-overlay .wc-layer");
      if (layers.length) _wcPop(layers[layers.length - 1]);
    }
    return;
  }

  if (active === "menu-screen") {
    if (key === "1") startVocab("th2en");
    else if (key === "2") startVocab("en2th");
    else if (key === "3") startQuiz();
    else if (key === "4") startVocabSRS();
    else if (key === "5") startConsonantFlash();
    else if (key === "6") startVowelFlash();
    else if (key === "7") startConsonantDrill();
    else if (key === "8") startVowelDrill();
    else if (key === "9") startScriptSRS();
    else if (key === "0") showStats();
    else if (key === "v" || key === "V") showVocabList();
    else if (key === "t" || key === "T") startToneDrill();
    else if (key === "s" || key === "S") startSentSRS();
    else if (key === "g" || key === "G") startGame();
    else if (key === "k" || key === "K") startTutor();
    else if (key === "b" || key === "B") startSoiBuakhao();
    else if (key === "c" || key === "C") startConnect4();
    else if (key === "?") showTutorial();
  }
  if (active === "c4-screen") {
    if (_c4Key(key)) return;
    if (key === "Escape") endSession();
    return;
  }
  if (active === "soi-screen") {
    if (_sbKey(key)) return;
    if (key === "Escape") endSession();
    return;
  }
  if (active === "tutor-screen") {
    if (_tType(key)) return;
    if (key === "Escape") endSession();
    return;
  }
  if (active === "game-screen") {
    if (_gKey(key)) return;
    if (key === "Escape") endSession();
    return;
  }
  if (active === "flash-screen") {
    if (key === " " || key === "Enter") {
      const ra = document.getElementById("flash-answer-area");
      if (ra.style.display === "none") flashReveal();
    }
    if (key === "u" || key === "U") undoLastRating();
    if (key === "Escape") endSession();
    if (["1","2","3","4","5"].includes(key)) {
      const btns = document.querySelectorAll("#flash-rating-row .rating-btn");
      if (btns.length && document.getElementById("flash-answer-area").style.display !== "none")
        btns[parseInt(key) - 1]?.click();
    }
  }
  if (active === "quiz-screen") {
    if (["1","2","3","4"].includes(key) && !session.answered)
      quizAnswer(parseInt(key) - 1);
    if ((key === "Enter" || key === " ") && session.answered) quizNext();
    if (key === "Escape") endSession();
  }
  if (active === "drill-screen") {
    if (key === "Enter" || key === " " || key === "ArrowRight") drillNext();
    if (key === "Escape") endSession();
  }
  if (active === "srs-screen") {
    if (key === " " || key === "Enter") {
      if (document.getElementById("srs-answer-area").style.display === "none") srsReveal();
    }
    if (key === "u" || key === "U") undoLastRating();
    if (key === "Escape") endSession();
    if (["1","2","3","4","5"].includes(key)) {
      const btns = document.querySelectorAll("#srs-rating-row .rating-btn");
      if (btns.length && document.getElementById("srs-answer-area").style.display !== "none")
        btns[parseInt(key) - 1]?.click();
    }
  }
  if (active === "tone-drill-screen") {
    if (["1","2","3","4","5"].includes(key) && !session.answered) {
      const lis = document.querySelectorAll("#tone-choices li");
      if (lis[parseInt(key) - 1]) lis[parseInt(key) - 1].click();
    }
    if ((key === "Enter" || key === " ") && session.answered) toneDrillNext();
    if (key === "r" || key === "R") toneDrillPlay();
    if (key === "Escape") endSession();
  }
  if (active === "sent-srs-screen") {
    if (key === " " || key === "Enter") {
      if (document.getElementById("sent-answer-area").style.display === "none") sentSrsReveal();
    }
    if (key === "u" || key === "U") undoLastRating();
    if (key === "Escape") endSession();
    if (["1","2","3","4","5"].includes(key)) {
      const btns = document.querySelectorAll("#sent-rating-row .rating-btn");
      if (btns.length && document.getElementById("sent-answer-area").style.display !== "none")
        btns[parseInt(key) - 1]?.click();
    }
  }
  if (["cat-screen","stats-screen","end-screen"].includes(active)) {
    if (key === "Escape") showMenu();
  }
});

// ─── init ──────────────────────────────────────────────────────────────────
updateMenuStats();
maybeShowTutorial();

// Android hardware back button (Capacitor only): behave like Escape, and
// exit the app only from the top-level menu. Registering a listener is what
// suppresses Capacitor's default exit-on-back behaviour.
const _capApp = window.Capacitor?.Plugins?.App;
if (_capApp?.addListener) {
  _capApp.addListener("backButton", () => {
    const atMenu =
      document.querySelector(".screen.active")?.id === "menu-screen" &&
      !document.getElementById("tutorial-overlay").classList.contains("open") &&
      !document.getElementById("wc-overlay").classList.contains("open");
    if (atMenu) _capApp.exitApp();
    else document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  });
}
