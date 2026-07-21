// Pattaya Idioms — a distinct reference section for the load-bearing culture /
// obligation / relationship concepts of the nightlife world. These are ADVANCED
// idioms held deliberately OUT of the beginner phonics ladder and the SRS store:
// their own small dataset here, not the WORDS list. DOM-free at load (the DOM is
// only touched inside functions the tests never call), so it vm-loads cleanly.
// Each item: [thai, romanisation, english, cultural note?].

const PATTAYA_IDIOMS = [
  { key: "obligation", label: "💠 Obligation & the debt economy", items: [
    ["บุญคุณ", "bun-khun", "a debt of gratitude",
      "The debt cash can't close. Owe it to a lifesaver, a parent or a teacher and they may call the favour at any time — and you can't refuse."],
    ["กตัญญู", "kà-tan-yuu", "gratitude & duty to parents / benefactors",
      "Supporting the family back home. Failing it is close to the ultimate sin."],
    ["เกรงใจ", "kreeng-jai", "considerate reluctance to impose",
      "Cuts both ways: the fear of owing a debt AND the fear of putting someone else in one. It's why a girl may refuse your money — she won't carry the debt it creates."],
    ["น้ำใจ", "náam-jai", "generosity — 'water of the heart'",
      "Proven by giving back a little MORE than you got, unprompted."],
    ["ตอบแทน", "tòop-thaen", "to reciprocate / return a kindness",
      "Repay a favour with a bit more, a few days later — never the exact amount, never on the spot. Instant exact repayment is an insult."],
    ["เท่าไหร่", "thâo-rài", "how much?",
      "The veteran's defence — asked before accepting any 'free' favour, drink or shortcut, to know the terms before owing anything."],
    ["เลี้ยงดู", "líang-duu", "to provide for / take care of",
      "Love as a verb. Money isn't a substitute for love here — it's the physical proof of it."],
    ["ของฟรีไม่มีในโลก", "khǒong-frii-mâi-mii-nai-lôok", "there are no free things in the world",
      "If something seems free, you just haven't worked out which currency you'll pay in yet."],
    ["ทุกอย่างมีราคา", "thúk-yàang-mii-raa-khaa", "everything has a price",
      "Not cynicism — honesty. Better to know the price up front than discover the hidden cost too late."],
  ]},
  { key: "relationship", label: "💔 Relationships", items: [
    ["เมีย", "mia", "wife (colloquial)", ""],
    ["ผัว", "phǔa", "husband (colloquial)", ""],
    ["เมียหลวง", "mia-lǔang", "major / first wife", ""],
    ["เมียน้อย", "mia-nói", "minor / second wife (mistress)",
      "The 'overseas branch manager' arrangement. She knows about the wife back home — secrecy buys nothing; the steady money is the whole deal."],
    ["ขายตัวไม่ได้ขายใจ", "khǎai-tua-mâi-dâai-khǎai-jai", "sell the body, not the heart",
      "The firewall: the transaction is physical; the heart stays home with the family."],
  ]},
  { key: "street", label: "🗯️ Street slang", items: [
    ["ควาย", "khwaai", "buffalo (= idiot)",
      "A public shaming insult, yelled the length of the soi."],
    ["สบาย", "sà-baai", "comfortable / at ease", "Half of 'sabai sabai' — the easy, unbothered ideal."],
    ["สนุก", "sà-nùk", "fun / a good time",
      "The whole point of a night out — the สนุก meter the games keep score with."],
  ]},
];

function _idEsc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// tap a phrase → the shared word-card (decomposition / translation / examples)
function _idiomModal(g, i) {
  const it = PATTAYA_IDIOMS[g].items[i];
  openWordModal([it[0], it[1], it[2]]);
}
function _idiomSpeak(th) { _tts.speak(th); }

function _buildIdioms() {
  let html = "";
  PATTAYA_IDIOMS.forEach((grp, gi) => {
    html += `<div class="idiom-group-label">${_idEsc(grp.label)}</div><div class="idiom-grid">`;
    grp.items.forEach(([th, rom, en, note], ii) => {
      html +=
        `<div class="idiom-card">` +
          `<div class="idiom-head">` +
            `<button class="idiom-thai" onclick="_idiomModal(${gi},${ii})" title="tap for the breakdown">${_idEsc(th)}</button>` +
            `<button class="idiom-spk" onclick="_idiomSpeak('${th}')" aria-label="listen">🔊</button>` +
          `</div>` +
          `<div class="idiom-rom">${_idEsc(rom)}</div>` +
          `<div class="idiom-en">${_idEsc(en)}</div>` +
          (note ? `<div class="idiom-note">${_idEsc(note)}</div>` : "") +
        `</div>`;
    });
    html += `</div>`;
  });
  document.getElementById("idioms-body").innerHTML = html;
}

function showIdioms() {
  _buildIdioms();
  showScreen("idioms-screen", "I");
}
