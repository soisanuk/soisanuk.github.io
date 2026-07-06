// Soi Buakhao — Pattaya Dialogue Visual Novel
// 3-night bar crawl. Navigate Thai conversation with a hostess.
// Score ≥ 60% correct each night for a happy ending.

// ── Venue & character data ─────────────────────────────────────────────────

const _SB_BARS = [
  "Lucky Tiger Bar", "Pink Lotus Lounge", "Neon Paradise A-Go-Go",
  "Golden Dragon Bar", "Sunset Dreams Lounge", "Starlight Bar",
  "Rainbow Girls Bar", "Paradise Nights Club", "Gold Rush Lounge",
  "Silk Rose Bar", "Club Mirage", "Jasmine Garden Bar",
  "Crystal Palace A-Go-Go", "Midnight Sun Bar",
];

const _SB_HOSTESSES = [
  { name:"Lek",  th:"เล็ก",  e:"💃", desc:"a petite girl with a bright smile and glittery earrings" },
  { name:"Noi",  th:"น้อย",  e:"🌸", desc:"a tall girl with long dark hair and a knowing look" },
  { name:"Ping", th:"ปิง",   e:"✨", desc:"a cheerful girl in a sparkly top who never stops smiling" },
  { name:"Aom",  th:"อ้อม",  e:"🌙", desc:"a mysterious girl with sharp eyes and a slow smile" },
  { name:"Joy",  th:"จอย",   e:"💕", desc:"a bubbly girl who laughs at everything you say" },
  { name:"Fon",  th:"ฝน",    e:"🌺", desc:"a shy girl who warms up the moment you speak Thai" },
  { name:"Gift", th:"กิ๊ฟ",  e:"💎", desc:"a confident girl with perfect makeup and sharp wit" },
  { name:"Kwan", th:"กวาง",  e:"🦋", desc:"a gentle girl with a soft voice and gentle eyes" },
];

// ── Dialogue pools ─────────────────────────────────────────────────────────
// Each entry: q (Thai), rom (romanisation), en (English), choices[]
// Each choice: th, rom, en, ok (bool)

const _SB_QS = {
  1: [
    {
      q:"สวัสดีค่ะ คุณชื่ออะไรคะ?", rom:"Sà-wàt-dii khâ. Khun chûue à-rai khâ?", en:"Hello! What's your name?",
      choices:[
        {th:"ผมชื่อเดฟครับ ยินดีที่รู้จักครับ",  rom:"Phǒm chûue Dave khráp. Yin-dii thîi rúu-jàk khráp.",   en:"My name's Dave. Nice to meet you.", ok:true},
        {th:"ผมไม่รู้จักคุณครับ",                rom:"Phǒm mâi rúu-jàk khun khráp.",                          en:"I don't know you.",                ok:false},
        {th:"ขอบคุณมากครับ",                      rom:"Khàawp-khun mâak khráp.",                                en:"Thank you very much.",             ok:false},
        {th:"ผมหิวข้าวมากครับ",                  rom:"Phǒm hǐu khâao mâak khráp.",                            en:"I'm very hungry.",                 ok:false},
      ],
    },
    {
      q:"คุณมาจากประเทศไหนคะ?", rom:"Khun maa-jàak prà-thêet nǎi khâ?", en:"What country are you from?",
      choices:[
        {th:"ผมมาจากอังกฤษครับ",                 rom:"Phǒm maa-jàak Ang-grìt khráp.",                         en:"I come from England.",             ok:true},
        {th:"ผมอยู่ที่นี่ครับ",                   rom:"Phǒm yùu thîi-nîi khráp.",                               en:"I'm here.",                        ok:false},
        {th:"ผมชอบประเทศไทยครับ",                rom:"Phǒm châawp prà-thêet Thai khráp.",                      en:"I like Thailand.",                 ok:false},
        {th:"ผมไม่เข้าใจครับ",                   rom:"Phǒm mâi khâo-jai khráp.",                               en:"I don't understand.",              ok:false},
      ],
    },
    {
      q:"คุณจะอยู่พัทยานานแค่ไหนคะ?", rom:"Khun jà yùu Phat-tha-yaa naan khâe-nǎi khâ?", en:"How long will you stay in Pattaya?",
      choices:[
        {th:"ผมจะอยู่สามวันครับ",                rom:"Phǒm jà yùu sǎam wan khráp.",                           en:"I'll stay three days.",            ok:true},
        {th:"ผมชอบกินข้าวผัดครับ",               rom:"Phǒm châawp gin khâao-phàt khráp.",                      en:"I like fried rice.",               ok:false},
        {th:"โรงแรมผมอยู่ใกล้ครับ",              rom:"Roong-raem phǒm yùu glâi khráp.",                        en:"My hotel is nearby.",              ok:false},
        {th:"ผมไม่มีเงินครับ",                   rom:"Phǒm mâi mii ngoen khráp.",                               en:"I have no money.",                 ok:false},
      ],
    },
    {
      q:"คุณมาพัทยาคนเดียวหรือเปล่าคะ?", rom:"Khun maa Phat-tha-yaa khon-diaw rǔue-plào khâ?", en:"Did you come to Pattaya alone?",
      choices:[
        {th:"ใช่ครับ มาคนเดียวเลยครับ",          rom:"Châi khráp. Maa khon-diaw looei khráp.",                 en:"Yes, completely alone.",           ok:true},
        {th:"ผมมากับสุนัขครับ",                   rom:"Phǒm maa gàp sù-nák khráp.",                             en:"I came with my dog.",              ok:false},
        {th:"ผมไม่รู้จักพัทยาครับ",              rom:"Phǒm mâi rúu-jàk Phat-tha-yaa khráp.",                   en:"I don't know Pattaya.",            ok:false},
        {th:"ผมต้องการน้ำแข็งครับ",              rom:"Phǒm tâwng-gaan náam-khǎeng khráp.",                     en:"I need some ice.",                 ok:false},
      ],
    },
    {
      q:"คุณอยากดื่มอะไรคะ?", rom:"Khun yàak dùuem à-rai khâ?", en:"What would you like to drink?",
      choices:[
        {th:"ขอเบียร์เย็นๆ หน่อยครับ",           rom:"Khǎaw bia yen-yen nàauy khráp.",                         en:"A cold beer please.",              ok:true},
        {th:"ผมไม่ดื่มแอลกอฮอล์ครับ",           rom:"Phǒm mâi dùuem aeo-gaw-haw khráp.",                      en:"I don't drink alcohol.",           ok:false},
        {th:"ผมกลับบ้านแล้วครับ",                rom:"Phǒm glàp bâan láew khráp.",                              en:"I already went home.",             ok:false},
        {th:"ขอเมนูอาหารครับ",                   rom:"Khǎaw me-nuu aa-hǎan khráp.",                             en:"The food menu please.",            ok:false},
      ],
    },
  ],

  2: [
    {
      q:"คุณมีแฟนอยู่ที่บ้านไหมคะ?", rom:"Khun mii faen yùu thîi bâan mǎi khâ?", en:"Do you have a girlfriend back home?",
      choices:[
        {th:"เปล่าครับ ผมโสดครับ",               rom:"Plào khráp. Phǒm sòot khráp.",                           en:"No, I'm single.",                  ok:true},
        {th:"ผมแต่งงานแล้วครับ แต่เธอไม่รู้",    rom:"Phǒm tàeng-ngaan láew. Tâe thooe mâi rúu.",             en:"Married, but she doesn't know.",   ok:false},
        {th:"ผมชอบดูหนังครับ",                   rom:"Phǒm châawp duu nǎng khráp.",                            en:"I like watching movies.",          ok:false},
        {th:"ขอโทษครับ ผมไม่เข้าใจ",            rom:"Khǎaw-thôot khráp. Phǒm mâi khâo-jai.",                  en:"Sorry, I don't understand.",       ok:false},
      ],
    },
    {
      q:"คุณคิดว่าฉันสวยไหมคะ?", rom:"Khun khít wâa chǎn sǔuay mǎi khâ?", en:"Do you think I'm beautiful?",
      choices:[
        {th:"สวยมากครับ คุณสวยที่สุดในบาร์นี้เลย", rom:"Sǔuay mâak khráp. Khun sǔuay thîi-sùt nai baa níi.", en:"Very! You're the prettiest here.", ok:true},
        {th:"ผมไม่แน่ใจครับ",                    rom:"Phǒm mâi nâe-jai khráp.",                                en:"I'm not sure.",                    ok:false},
        {th:"ห้องน้ำอยู่ที่ไหนครับ?",            rom:"Hâwng-náam yùu thîi-nǎi khráp?",                         en:"Where is the bathroom?",           ok:false},
        {th:"ผมเหนื่อยมากครับ",                  rom:"Phǒm nùueai mâak khráp.",                                en:"I'm very tired.",                  ok:false},
      ],
    },
    {
      q:"คุณพูดภาษาไทยได้ไหมคะ?", rom:"Khun phûut phaa-sǎa Thai dâi mǎi khâ?", en:"Can you speak Thai?",
      choices:[
        {th:"ได้นิดหน่อยครับ กำลังเรียนอยู่ครับ", rom:"Dâi nít-nàauy khráp. Gam-lang rian yùu khráp.",       en:"A little. I'm studying it.",       ok:true},
        {th:"ผมพูดได้ทุกภาษาครับ",                rom:"Phǒm phûut dâi thúk phaa-sǎa khráp.",                   en:"I can speak all languages.",       ok:false},
        {th:"ผมไม่ชอบภาษาไทยครับ",               rom:"Phǒm mâi châawp phaa-sǎa Thai khráp.",                   en:"I don't like Thai.",               ok:false},
        {th:"ขอเบียร์อีกขวดครับ",                rom:"Khǎaw bia ìik khùuat khráp.",                             en:"Another beer please.",             ok:false},
      ],
    },
    {
      q:"คุณทำงานอะไรคะ?", rom:"Khun tham-ngaan à-rai khâ?", en:"What do you do for work?",
      choices:[
        {th:"ผมทำงานด้านไอทีครับ",               rom:"Phǒm tham-ngaan dâan ai-thii khráp.",                    en:"I work in IT.",                    ok:true},
        {th:"ผมชอบสาวไทยครับ",                   rom:"Phǒm châawp sǎao Thai khráp.",                           en:"I like Thai girls.",               ok:false},
        {th:"ผมมาจากออสเตรเลียครับ",             rom:"Phǒm maa-jàak Àwt-sà-tree-lia khráp.",                   en:"I'm from Australia.",              ok:false},
        {th:"ผมหิวครับ",                          rom:"Phǒm hǐu khráp.",                                         en:"I'm hungry.",                      ok:false},
      ],
    },
    {
      q:"คุณชอบอาหารไทยไหมคะ?", rom:"Khun châawp aa-hǎan Thai mǎi khâ?", en:"Do you like Thai food?",
      choices:[
        {th:"ชอบมากครับ โดยเฉพาะผัดไทยครับ",    rom:"Châawp mâak khráp. Dooi-chà-phâaw phàt-thai khráp.",   en:"Love it, especially Pad Thai.",    ok:true},
        {th:"กินไม่เป็นครับ",                    rom:"Gin mâi pen khráp.",                                      en:"I can't eat it.",                  ok:false},
        {th:"วันนี้ฝนตกครับ",                    rom:"Wan-níi fǒn tòk khráp.",                                  en:"It's raining today.",              ok:false},
        {th:"ผมต้องกลับโรงแรมครับ",              rom:"Phǒm tâwng glàp roong-raem khráp.",                      en:"I have to go back to the hotel.",  ok:false},
      ],
    },
  ],

  3: [
    {
      q:"คืนนี้คุณหล่อมากเลยค่ะ", rom:"Khuuen-níi khun làaw mâak looei khâ.", en:"You look very handsome tonight.",
      choices:[
        {th:"ขอบคุณครับ คุณก็สวยมากเหมือนกันครับ", rom:"Khàawp-khun khráp. Khun gâaw sǔuay mâak mǔuean-gan.", en:"Thanks! You're beautiful too.", ok:true},
        {th:"ผมรู้ครับ",                          rom:"Phǒm rúu khráp.",                                         en:"I know.",                          ok:false},
        {th:"ขอบิลครับ",                          rom:"Khǎaw bin khráp.",                                         en:"Check please.",                    ok:false},
        {th:"ผมอยากนอนครับ",                     rom:"Phǒm yàak naawn khráp.",                                  en:"I want to sleep.",                 ok:false},
      ],
    },
    {
      q:"คุณอยากไปไหนกันไหมคะ?", rom:"Khun yàak pai nǎi gan mǎi khâ?", en:"Want to go somewhere together?",
      choices:[
        {th:"อยากไปมากครับ คุณอยากไปไหน?",      rom:"Yàak pai mâak khráp. Khun yàak pai nǎi?",               en:"I'd love to. Where do you want to go?", ok:true},
        {th:"ผมต้องอยู่ที่นี่ครับ",               rom:"Phǒm tâwng yùu thîi-nîi khráp.",                         en:"I have to stay here.",             ok:false},
        {th:"ผมโทรหาเพื่อนก่อนครับ",             rom:"Phǒm thoo hǎa phûuean gàawn khráp.",                     en:"I need to call my friend first.",  ok:false},
        {th:"ผมไม่มีเวลาครับ",                   rom:"Phǒm mâi mii welaa khráp.",                               en:"I don't have time.",               ok:false},
      ],
    },
    {
      q:"ฉันชอบคุณมากนะคะ คุณล่ะ?", rom:"Chǎn châawp khun mâak ná khâ. Khun lâ?", en:"I really like you. What about you?",
      choices:[
        {th:"ผมก็ชอบคุณมากเหมือนกันครับ",        rom:"Phǒm gâaw châawp khun mâak mǔuean-gan khráp.",           en:"I really like you too.",           ok:true},
        {th:"ผมชอบเบียร์มากกว่าครับ",            rom:"Phǒm châawp bia mâak-gwàa khráp.",                       en:"I like beer more.",                ok:false},
        {th:"คุณพูดเร็วเกินไปครับ",              rom:"Khun phûut reo geoen-pai khráp.",                         en:"You speak too fast.",              ok:false},
        {th:"ผมต้องกลับบ้านแล้วครับ",           rom:"Phǒm tâwng glàp bâan láew khráp.",                       en:"I have to go home now.",           ok:false},
      ],
    },
    {
      q:"คุณอยากอยู่กับฉันคืนนี้ไหมคะ?", rom:"Khun yàak yùu gàp chǎn khuuen-níi mǎi khâ?", en:"Would you like to spend tonight with me?",
      choices:[
        {th:"อยากมากครับ คืนนี้คงสนุกมากแน่ๆ",  rom:"Yàak mâak khráp. Khuuen-níi khong sà-nùk mâak nâe-nâe.", en:"Very much. Tonight's going to be a lot of fun.", ok:true},
        {th:"ผมต้องโทรหาภรรยาก่อนครับ",         rom:"Phǒm tâwng thoo hǎa phan-rá-yaa gàawn khráp.",           en:"I need to call my wife first.",    ok:false},
        {th:"ราคาเท่าไหร่ครับ?",                 rom:"Raa-khaa thâo-rài khráp?",                                en:"How much does it cost?",           ok:false},
        {th:"ผมเหนื่อยมากครับ",                  rom:"Phǒm nùueai mâak khráp.",                                 en:"I'm very tired.",                  ok:false},
      ],
    },
    {
      q:"คุณเป็นคนใจดีมากค่ะ ฉันชอบคุณจริงๆ", rom:"Khun pen khon jai-dii mâak khâ. Chǎn châawp khun jing-jing.", en:"You're so kind. I genuinely like you.",
      choices:[
        {th:"ขอบคุณครับ ผมก็รู้สึกดีกับคุณมากครับ", rom:"Khàawp-khun khráp. Phǒm gâaw rúu-sùek dii gàp khun mâak.", en:"Thank you. I feel great about you too.", ok:true},
        {th:"ผมต้องการเงินคืนครับ",               rom:"Phǒm tâwng-gaan ngoen khuuen khráp.",                    en:"I want my money back.",            ok:false},
        {th:"ฝนตกครับ",                           rom:"Fǒn tòk khráp.",                                          en:"It's raining.",                    ok:false},
        {th:"ผมไม่ได้ยินครับ",                   rom:"Phǒm mâi dâi-yin khráp.",                                en:"I didn't hear you.",               ok:false},
      ],
    },
  ],
};

// ── Night-end scenes ───────────────────────────────────────────────────────

const _SB_ENDS = {
  happy: [
    { title:"สนุกมาก! 🥂", scene:"{n} orders another round and slides a little closer.\n\"Buy me a lady drink?\" she asks, already signalling the barman.\nThe night is just getting started." },
    { title:"ดีมาก! 💕",   scene:"{n} rests her hand lightly on yours across the table.\n\"Same bar tomorrow night?\" she asks, with a smile that already knows the answer.\nYou order two more beers." },
    { title:"คืนนี้ดีมาก! 🌙", scene:"{n} leans in and whispers something in your ear. You both laugh.\nThe barman gives you a slow, knowing wink.\nSome nights in Pattaya you never forget." },
  ],
  sad: [
    { title:"โชคไม่ดี 😔",  scene:"{n} smiles politely and turns to the next customer.\nYou finish your beer alone, staring into the neon.\nBetter Thai next time, ฝรั่ง." },
    { title:"คืนนี้ไม่ดี 😞", scene:"{n} glances at her phone and suddenly has somewhere to be.\nYou get the hint.\nThe taxi ride home is a quiet one." },
    { title:"เสียใจมาก 💔", scene:"2am. The last stool at the bar is a lonely place.\n{n} is laughing with someone else now.\nThere's always tomorrow night." },
  ],
};

// ── Grand finales ──────────────────────────────────────────────────────────

const _SB_FINALE = {
  "3-0":{ title:"🌟 Pattaya Legend — ยอดเยี่ยม!", emoji:"🏆🍺💃", text:"Three nights. Three bars. Three connections. Your Thai was sharp, your charm was sharper. The expat forums will never know what happened, but Pattaya will remember." },
  "2-1":{ title:"😊 Decent Showing — ดีมาก",       emoji:"✨🌙🍺", text:"Two out of three nights ended well. Pattaya rewarded your effort. A little more vocabulary and next trip could be legendary." },
  "1-2":{ title:"😐 Room for Improvement — พอใช้", emoji:"📚🍺😅", text:"One good night out of three. The intent was clearly there. Pattaya is patient. Your Thai needs work — the app still works at 3am." },
  "0-3":{ title:"😢 Go Home and Study — ต้องเรียนเพิ่ม", emoji:"📱😶7️⃣", text:"Three nights, three 7-Eleven receipts, and a lot of quality time alone with your thoughts. The bright side: at least you can order a Chang without pointing now." },
};

// ── State ──────────────────────────────────────────────────────────────────

let _sbNight    = 1;
let _sbQs       = [];
let _sbQIdx     = 0;
let _sbScore    = 0;
let _sbResults  = [];
let _sbBar      = "";
let _sbHost     = null;
let _sbAnswered = false;

// ── Helpers ────────────────────────────────────────────────────────────────

function _sbEsc(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function _sbSample(arr, n) {
  return arr.slice().sort(() => Math.random() - 0.5).slice(0, n);
}

function _sbBody() { return document.getElementById("soi-body"); }

function _sbHead(sub) {
  document.getElementById("soi-night-label").textContent = `🌙 Soi Buakhao — Night ${_sbNight} of 3`;
  document.getElementById("soi-sub-label").textContent   = sub || "";
}

// Render tokenised Thai text; known words become clickable spans.
function _sbThai(el, text) {
  let html = "";
  try {
    for (const tok of _tokenise(text)) {
      if (tok.word) {
        html += `<span class="sb-w" data-w="${_sbEsc(tok.text)}">${_sbEsc(tok.text)}</span>`;
      } else {
        html += _sbEsc(tok.text);
      }
    }
  } catch(_) { html = _sbEsc(text); }
  el.innerHTML = html;
  el.querySelectorAll(".sb-w").forEach(s => {
    const w = WORD_MAP[s.dataset.w];
    if (!w) return;
    s.style.cursor = "pointer";
    s.addEventListener("click", () => openWordModal(w));
  });
}

// ── Entry point ────────────────────────────────────────────────────────────

function startSoiBuakhao() {
  showScreen("soi-screen", "B");
  _sbNight   = 1;
  _sbResults = [];
  _sbStartNight();
}

function _sbStartNight() {
  _sbBar      = _SB_BARS[Math.floor(Math.random() * _SB_BARS.length)];
  _sbHost     = _SB_HOSTESSES[Math.floor(Math.random() * _SB_HOSTESSES.length)];
  _sbQs       = _sbSample(_SB_QS[_sbNight], 4);
  _sbQIdx     = 0;
  _sbScore    = 0;
  _sbShowIntro();
}

// ── Intro ──────────────────────────────────────────────────────────────────

function _sbShowIntro() {
  _sbHead("");
  const h = _sbHost;
  _sbBody().innerHTML = `
    <div class="sb-bar-sign">✦ ${_sbEsc(_sbBar)} ✦</div>
    <div class="sb-host-intro">
      <div class="sb-host-emoji">${h.e}</div>
      <div class="sb-host-name">${_sbEsc(h.name)} <span class="sb-host-th">(${_sbEsc(h.th)})</span></div>
      <div class="sb-host-desc">${_sbEsc(h.desc)}</div>
    </div>
    <p class="sb-scene-text">You push open the door. The bass thumps. Neon bounces off every surface.<br>
    A girl catches your eye and slides off her stool with a smile.</p>
    <button class="sb-btn" onclick="_sbNextQ()">เข้าไปเลย — Let's go →</button>
  `;
}

// ── Question ───────────────────────────────────────────────────────────────

function _sbNextQ() {
  if (_sbQIdx >= _sbQs.length) { _sbShowNightEnd(); return; }
  _sbAnswered = false;
  const q       = _sbQs[_sbQIdx];
  const h       = _sbHost;
  const choices = q.choices.slice().sort(() => Math.random() - 0.5);
  const letters = ["A","B","C","D"];

  _sbHead(`Q ${_sbQIdx + 1} / ${_sbQs.length}`);
  _sbBody().innerHTML = `
    <div class="sb-bubble-wrap">
      <div class="sb-avatar">${h.e}</div>
      <div class="sb-bubble">
        <div class="sb-bname">${_sbEsc(h.name)}</div>
        <div class="sb-q-thai" id="sb-q-thai"></div>
        <div class="sb-rom">${_sbEsc(q.rom)}</div>
        <div class="sb-en">${_sbEsc(q.en)}</div>
      </div>
    </div>
    <div class="sb-choices" id="sb-choices"></div>
    <div class="sb-prog-wrap"><div class="sb-prog-bar" id="sb-prog"></div></div>
  `;

  _sbThai(document.getElementById("sb-q-thai"), q.q);
  _tts.speak(q.q);

  document.getElementById("sb-prog").style.width =
    (_sbQIdx / _sbQs.length * 100) + "%";

  const choicesEl = document.getElementById("sb-choices");
  choices.forEach((c, i) => {
    const btn = document.createElement("button");
    btn.className     = "sb-choice";
    btn.dataset.ok    = c.ok ? "1" : "0";
    btn.dataset.idx   = i;
    btn.innerHTML = `
      <span class="sb-cletter">${letters[i]}</span>
      <div class="sb-cbody">
        <div class="sb-cth">${_sbEsc(c.th)}</div>
        <div class="sb-crom">${_sbEsc(c.rom)}</div>
        <div class="sb-cen">${_sbEsc(c.en)}</div>
      </div>`;
    btn.addEventListener("click", () => _sbAnswer(btn, c));
    choicesEl.appendChild(btn);
  });
}

// ── Answer ─────────────────────────────────────────────────────────────────

function _sbAnswer(btn, choice) {
  if (_sbAnswered) return;
  _sbAnswered = true;
  _audio.sfx(choice.ok ? "good" : "bad");
  _tts.speak(choice.th);

  if (choice.ok) _sbScore++;

  document.querySelectorAll(".sb-choice").forEach(b => {
    b.disabled = true;
    if (b.dataset.ok === "1") b.classList.add("sb-ok");
  });
  if (!choice.ok) btn.classList.add("sb-wrong");

  const h = _sbHost;
  const good = [
    `ใช่แล้วค่ะ! 😍 เก่งมากเลย`,
    `ถูกต้องค่ะ! ✨ คุณพูดไทยเก่งจัง`,
    `โอ้โห! 💕 ภาษาไทยคุณดีมากเลยค่ะ`,
    `เยี่ยมเลยค่ะ! 🥰`,
  ];
  const bad = [
    `ไม่ใช่ค่ะ 😅 ลองใหม่นะคะ`,
    `เอาใหม่ได้นะคะ 🙈`,
    `โอ๊ะ ไม่ถูกค่ะ 😂 ไม่เป็นไรค่ะ`,
    `คราวหน้าจะดีกว่านี้นะคะ 😊`,
  ];
  const pool = choice.ok ? good : bad;
  const line = pool[Math.floor(Math.random() * pool.length)];

  const react = document.createElement("div");
  react.className = "sb-react " + (choice.ok ? "sb-react-ok" : "sb-react-bad");
  react.innerHTML = `${h.e} <strong>${_sbEsc(h.name)}:</strong> "${_sbEsc(line)}"`;
  document.getElementById("sb-choices").after(react);

  const nxt = document.createElement("button");
  nxt.className   = "sb-btn sb-btn-nxt";
  nxt.textContent = _sbQIdx + 1 >= _sbQs.length ? "สรุปคืนนี้ →" : "ต่อไป →";
  nxt.addEventListener("click", () => { _sbQIdx++; _sbNextQ(); });
  react.after(nxt);
}

// ── Night end ──────────────────────────────────────────────────────────────

function _sbShowNightEnd() {
  const happy  = _sbScore >= Math.ceil(_sbQs.length * 0.6);
  _sbResults.push(happy);
  _audio.sfx(happy ? "win" : "lose");
  const end    = _SB_ENDS[happy ? "happy" : "sad"][_sbNight - 1];
  const scene  = end.scene.replace(/\{n\}/g, _sbHost.name);
  const h      = _sbHost;

  _sbHead(happy ? "Happy Ending 🥂" : "Going Home Alone 😔");
  _sbBody().innerHTML = `
    <div class="sb-night-end ${happy ? "sb-he" : "sb-se"}">
      <div class="sb-end-avatar">${h.e}</div>
      <div class="sb-end-title">${_sbEsc(end.title)}</div>
      <div class="sb-end-score">${_sbScore} / ${_sbQs.length} correct</div>
      <div class="sb-end-scene">${_sbEsc(scene).replace(/\n/g,"<br>")}</div>
      ${_sbNight < 3
        ? `<button class="sb-btn" onclick="_sbNextNight()">คืนต่อไป — Night ${_sbNight+1} →</button>`
        : `<button class="sb-btn" onclick="_sbShowGameEnd()">จบการเดินทาง →</button>`}
      <button class="sb-btn sb-btn-ghost" onclick="endSession()">กลับบ้านก่อน</button>
    </div>`;
}

function _sbNextNight() { _sbNight++; _sbStartNight(); }

// ── Game end ───────────────────────────────────────────────────────────────

function _sbShowGameEnd() {
  const wins = _sbResults.filter(Boolean).length;
  const fin  = _SB_FINALE[`${wins}-${3-wins}`] || _SB_FINALE["1-2"];

  _sbHead("จบแล้ว — The End");
  _sbBody().innerHTML = `
    <div class="sb-finale">
      <div class="sb-finale-emoji">${fin.emoji}</div>
      <div class="sb-finale-title">${_sbEsc(fin.title)}</div>
      <div class="sb-finale-nights">
        ${_sbResults.map((r,i)=>`<span class="sb-nb ${r?"sb-nb-ok":"sb-nb-bad"}">Night ${i+1} ${r?"🥂":"😔"}</span>`).join("")}
      </div>
      <div class="sb-finale-text">${_sbEsc(fin.text)}</div>
      <button class="sb-btn" onclick="startSoiBuakhao()">เล่นใหม่ — Play Again</button>
      <button class="sb-btn sb-btn-ghost" onclick="endSession()">กลับบ้าน — Go Home</button>
    </div>`;
}

// ── Keyboard (number keys 1-4 select choices, Enter advances) ─────────────

function _sbKey(key) {
  if (!document.getElementById("soi-screen").classList.contains("active")) return false;
  if (["1","2","3","4"].includes(key)) {
    const btns = document.querySelectorAll(".sb-choice:not([disabled])");
    if (btns[+key - 1]) { btns[+key - 1].click(); return true; }
  }
  if ((key === "Enter" || key === " ") && _sbAnswered) {
    const nxt = document.querySelector(".sb-btn-nxt");
    if (nxt) { nxt.click(); return true; }
  }
  return false;
}
