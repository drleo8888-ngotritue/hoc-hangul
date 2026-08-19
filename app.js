// ============ State & persistence ============
const STORAGE_KEY = 'hangul_app_progress_v1';
const SPEECH_RATE_KEY = 'hangul_speech_rate_v1';
let speechRate = parseFloat(localStorage.getItem(SPEECH_RATE_KEY)) || 0.7;
function saveSpeechRate() { localStorage.setItem(SPEECH_RATE_KEY, String(speechRate)); }
const MODULE_ICONS = {
  vowels: '아', consonants: '가', syllables: '나', compoundVowels: '애',
  doubleConsonants: '까', batchim: '받', soundChanges: '연',
};
const HANGUL_VIEWS = new Set(['home', 'moduleHome', 'learn', 'practice', 'result', 'builder']);
const VOCAB_VIEWS = new Set(['vocabHome', 'vocabTopic']);

// ============ Hangul syllable composition (Unicode formula) ============
const INITIAL_LIST = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const MEDIAL_LIST = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const FINAL_LIST = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

const INITIAL_ROMAN = { 'ㄱ':'g','ㄲ':'kk','ㄴ':'n','ㄷ':'d','ㄸ':'tt','ㄹ':'r','ㅁ':'m','ㅂ':'b','ㅃ':'pp','ㅅ':'s','ㅆ':'ss','ㅇ':'','ㅈ':'j','ㅉ':'jj','ㅊ':'ch','ㅋ':'k','ㅌ':'t','ㅍ':'p','ㅎ':'h' };
const MEDIAL_ROMAN = { 'ㅏ':'a','ㅐ':'ae','ㅑ':'ya','ㅒ':'yae','ㅓ':'eo','ㅔ':'e','ㅕ':'yeo','ㅖ':'ye','ㅗ':'o','ㅘ':'wa','ㅙ':'wae','ㅚ':'oe','ㅛ':'yo','ㅜ':'u','ㅝ':'wo','ㅞ':'we','ㅟ':'wi','ㅠ':'yu','ㅡ':'eu','ㅢ':'ui','ㅣ':'i' };
const FINAL_ROMAN = { '':'','ㄱ':'k','ㄲ':'k','ㄳ':'k','ㄴ':'n','ㄵ':'n','ㄶ':'n','ㄷ':'t','ㄹ':'l','ㄺ':'k','ㄻ':'m','ㄼ':'l','ㄽ':'l','ㄾ':'l','ㄿ':'p','ㅀ':'l','ㅁ':'m','ㅂ':'p','ㅄ':'p','ㅅ':'t','ㅆ':'t','ㅇ':'ng','ㅈ':'t','ㅊ':'t','ㅋ':'k','ㅌ':'t','ㅍ':'p','ㅎ':'t' };

function composeHangul(initial, medial, final) {
  const li = INITIAL_LIST.indexOf(initial);
  const mi = MEDIAL_LIST.indexOf(medial);
  const fi = FINAL_LIST.indexOf(final || '');
  if (li < 0 || mi < 0 || fi < 0) return '';
  const code = 0xAC00 + (li * 21 + mi) * 28 + fi;
  return String.fromCharCode(code);
}
function romanizeCombo(initial, medial, final) {
  return (INITIAL_ROMAN[initial] || '') + (MEDIAL_ROMAN[medial] || '') + (FINAL_ROMAN[final] || '');
}

const VOWEL_VERTICAL = new Set(['ㅏ', 'ㅑ', 'ㅓ', 'ㅕ', 'ㅣ', 'ㅐ', 'ㅒ', 'ㅔ', 'ㅖ']);
const VOWEL_HORIZONTAL = new Set(['ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ']);
const VOWEL_COMPLEX = new Set(['ㅘ', 'ㅙ', 'ㅚ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅢ']);
function layoutOfMedial(medial) {
  if (VOWEL_HORIZONTAL.has(medial)) return 'horizontal';
  if (VOWEL_COMPLEX.has(medial)) return 'complex';
  return 'vertical';
}

// Giải mã ngược một khối âm tiết Hangul thành phụ âm đầu / nguyên âm / batchim
function decomposeHangul(char) {
  if (!char || char.length !== 1) return null;
  const code = char.charCodeAt(0) - 0xAC00;
  if (code < 0 || code > 11171) return null; // không phải khối âm tiết đã ghép
  const fi = code % 28;
  const mi = Math.floor(code / 28) % 21;
  const li = Math.floor(code / 588);
  return { initial: INITIAL_LIST[li], medial: MEDIAL_LIST[mi], final: FINAL_LIST[fi] };
}

// Sinh lời giải thích vì sao các thành phần được ghép ở vị trí đó
function explainComposition(char) {
  const d = decomposeHangul(char);
  if (!d) return null;
  const { initial, medial, final } = d;
  const layout = layoutOfMedial(medial);
  const parts = [
    { char: initial, label: 'phụ âm đầu (초성)' },
    { char: medial, label: 'nguyên âm (중성)' },
  ];
  if (final) parts.push({ char: final, label: 'batchim (종성)' });

  let why;
  if (layout === 'horizontal') {
    why = `${medial} là nguyên âm có nét chính nằm NGANG, nên phụ âm đầu ${initial} đứng bên TRÊN và ${medial} đứng bên DƯỚI.`;
  } else if (layout === 'complex') {
    why = `${medial} là nguyên âm ghép (kết hợp cả nét ngang và dọc), nên khối chữ có cấu trúc ba phần phức tạp hơn bình thường.`;
  } else {
    why = `${medial} là nguyên âm có nét chính thẳng ĐỨNG, nên phụ âm đầu ${initial} đứng bên TRÁI và ${medial} đứng bên PHẢI.`;
  }
  if (initial === 'ㅇ') {
    why = `ㅇ ở vị trí đầu không phát âm — nó chỉ giữ chỗ vì mọi âm tiết tiếng Hàn đều phải bắt đầu bằng một phụ âm. ` + why;
  }
  if (final) {
    why += ` Vì âm tiết này có thêm phụ âm cuối (batchim) ${final}, nó luôn được xếp ở hàng DƯỚI CÙNG của khối, bất kể phần trên xếp kiểu nào.`;
  }
  return { parts, why };
}
function breakdownHTML(breakdown) {
  if (!breakdown) return '';
  const partsHTML = breakdown.parts.map((p, i) => `
    ${i > 0 ? '<span class="breakdown-plus">+</span>' : ''}
    <div class="breakdown-part"><span class="bp-char">${p.char}</span><span class="bp-label">${p.label}</span></div>
  `).join('');
  return `
    <div class="breakdown-box">
      <div class="breakdown-parts">${partsHTML}</div>
      <p class="breakdown-why">${breakdown.why}</p>
    </div>
  `;
}

let builderState = { initial: 'ㄱ', medial: 'ㅏ', final: '' };

let progress = loadProgress();
let state = { view: 'home', params: {} };
let session = null; // ephemeral practice/quiz session

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore corrupt storage */ }
  return {};
}
function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}
function ensureModuleProgress(moduleId) {
  if (!progress[moduleId]) {
    progress[moduleId] = { learned: [], quizBest: 0, quizPassed: false };
  }
  return progress[moduleId];
}

function getModule(id) { return MODULES.find(m => m.id === id); }
function getModuleIndex(id) { return MODULES.findIndex(m => m.id === id); }
function isModuleUnlocked(id) {
  const idx = getModuleIndex(id);
  if (idx <= 0) return true;
  const prev = MODULES[idx - 1];
  return !!(progress[prev.id] && progress[prev.id].quizPassed);
}

// ============ Utilities ============
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function sample(arr, n) { return shuffle(arr).slice(0, n); }

let speechReady = 'speechSynthesis' in window;
let koVoiceAvailable = null; // null = chưa xác định, true/false = đã kiểm tra xong

function refreshKoVoiceStatus() {
  if (!speechReady) { koVoiceAvailable = false; return; }
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return; // danh sách giọng chưa tải xong, thử lại sau
  koVoiceAvailable = voices.some(v => v.lang && v.lang.toLowerCase().startsWith('ko'));
  if (state.view === 'home') render();
}
if (speechReady) {
  refreshKoVoiceStatus();
  window.speechSynthesis.onvoiceschanged = refreshKoVoiceStatus;
}

function showToast(msg) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 4000);
}

function speak(text) {
  if (!speechReady) {
    showToast('Thiết bị này không hỗ trợ phát âm giọng nói.');
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = speechRate;
    const voices = window.speechSynthesis.getVoices();
    const koVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('ko'));
    if (koVoice) u.voice = koVoice;
    u.onerror = () => {
      showToast('Không phát được âm — thiết bị có thể chưa cài giọng đọc tiếng Hàn. Vào Cài đặt > Trợ năng > Chuyển văn bản thành giọng nói để kiểm tra.');
    };
    window.speechSynthesis.speak(u);
  } catch (e) {
    showToast('Không phát được âm trên thiết bị này.');
  }
}

// Đọc rời từng âm tiết, có khoảng dừng thật giữa các âm — hiệu quả trên mọi thiết bị
// vì không phụ thuộc thông số "rate" (nhiều engine Android bỏ qua rate của Web Speech API).
function speakSlow(text) {
  if (!speechReady) {
    showToast('Thiết bị này không hỗ trợ phát âm giọng nói.');
    return;
  }
  window.speechSynthesis.cancel();
  const syllables = Array.from(text).filter(ch => ch.trim().length > 0);
  const voices = window.speechSynthesis.getVoices();
  const koVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('ko'));
  let i = 0;
  function speakNext() {
    if (i >= syllables.length) return;
    const u = new SpeechSynthesisUtterance(syllables[i]);
    u.lang = 'ko-KR';
    u.rate = Math.min(speechRate, 0.8);
    if (koVoice) u.voice = koVoice;
    u.onend = () => { i++; setTimeout(speakNext, 420); };
    u.onerror = () => {
      i++;
      if (i === 1) showToast('Không phát được âm — thiết bị có thể chưa cài giọng đọc tiếng Hàn.');
      setTimeout(speakNext, 150);
    };
    window.speechSynthesis.speak(u);
  }
  speakNext();
}

// ============ Navigation ============
function navigate(view, params = {}) {
  state = { view, params };
  render();
}

// ============ Header progress ============
function updateHeaderProgress() {
  const wrap = document.getElementById('header-progress');
  const fill = document.getElementById('header-progress-fill');
  const label = document.getElementById('header-progress-label');
  let total = 0, learned = 0;
  MODULES.forEach(m => {
    total += m.letters.length;
    const mp = progress[m.id];
    if (mp) learned += mp.learned.length;
  });
  const pct = total ? Math.round((learned / total) * 100) : 0;
  fill.style.width = pct + '%';
  label.textContent = `${learned}/${total} chữ`;
  wrap.hidden = VOCAB_VIEWS.has(state.view);
}

// ============ HOME ============
function homeHTML() {
  const cards = MODULES.map(m => {
    const unlocked = isModuleUnlocked(m.id);
    const mp = progress[m.id];
    const learnedCount = mp ? mp.learned.length : 0;
    const total = m.letters.length;
    const pct = total ? Math.round((learnedCount / total) * 100) : 0;
    const quizBadge = mp && mp.quizPassed
      ? `<span style="color:var(--green)">✓ Đã đạt ${mp.quizBest}%</span>`
      : (mp && mp.quizBest ? `<span>Điểm tốt nhất: ${mp.quizBest}%</span>` : `<span>Chưa kiểm tra</span>`);
    return `
      <button class="module-card ${unlocked ? '' : 'locked'}" data-module="${m.id}" ${unlocked ? '' : 'disabled'}>
        <div class="module-glyph">${MODULE_ICONS[m.id]}</div>
        <div class="module-body">
          <h3>${m.title}</h3>
          <p>${m.subtitle}</p>
          ${unlocked ? `
          <div class="module-meta">
            <div class="mini-bar"><div class="mini-bar-fill" style="width:${pct}%"></div></div>
            <span>${learnedCount}/${total} · ${quizBadge}</span>
          </div>
          ` : `<div class="module-meta"><span>🔒 Cần đạt kiểm tra nhóm trước</span></div>`}
        </div>
      </button>
    `;
  }).join('');

  let speechNote = '';
  if (!speechReady) {
    speechNote = `<p class="home-note" style="color:var(--amber);">⚠️ Trình duyệt này không hỗ trợ phát âm — hãy thử Chrome/Edge.</p>`;
  } else if (koVoiceAvailable === false) {
    speechNote = `<p class="home-note" style="color:var(--amber);">⚠️ Máy chưa có giọng đọc tiếng Hàn. Vào Cài đặt máy > Trợ năng (Accessibility) > Chuyển văn bản thành giọng nói, tải thêm gói giọng Hàn Quốc — hoặc thử mở bằng trình duyệt Chrome.</p>`;
  }

  return `
    <h1 class="home-title">Học bảng chữ cái Hangul</h1>
    <p class="home-sub">Chọn nhóm chữ cái để bắt đầu. Đạt ≥80% kiểm tra để mở khóa nhóm tiếp theo.</p>
    ${speechNote}
    <div class="module-grid">${cards}</div>
    <p class="home-note">Tiến độ được lưu tự động trên trình duyệt này.</p>
  `;
}
function attachHome() {
  document.querySelectorAll('.module-card:not(.locked)').forEach(btn => {
    btn.addEventListener('click', () => navigate('moduleHome', { moduleId: btn.dataset.module }));
  });
}

// ============ MODULE HOME ============
function moduleHomeHTML(moduleId) {
  const m = getModule(moduleId);
  const mp = ensureModuleProgress(moduleId);
  const total = m.letters.length;
  const learnedCount = mp.learned.length;
  const pct = total ? Math.round((learnedCount / total) * 100) : 0;
  const idx = getModuleIndex(moduleId);
  const isLast = idx === MODULES.length - 1;

  return `
    <div class="back-row"><button class="btn btn-ghost" id="btn-back-home">← Trang chủ</button></div>
    <h2 class="view-title">${m.title}</h2>
    <p class="view-sub">${m.subtitle}</p>
    <p style="color:var(--ink-soft); font-size:12px; line-height:1.4; margin:0 0 10px;">${m.note}</p>

    <div class="header-progress" style="max-width:none; margin: 0 0 12px;">
      <div class="header-progress-bar"><div class="header-progress-fill" style="width:${pct}%"></div></div>
      <span style="font-size:12px;color:var(--ink-soft)">${learnedCount}/${total} đã học</span>
    </div>

    <div class="module-grid">
      <button class="module-card" id="btn-learn">
        <div class="module-glyph">📖</div>
        <div class="module-body"><h3>Học từng chữ</h3><p>Xem chữ, nghe phát âm, tập viết nét</p></div>
      </button>
      <button class="module-card" id="btn-practice-listen">
        <div class="module-glyph">🎧</div>
        <div class="module-body"><h3>Luyện nghe → chọn chữ</h3><p>Nghe âm thanh và chọn đúng chữ cái</p></div>
      </button>
      <button class="module-card" id="btn-practice-look">
        <div class="module-glyph">👀</div>
        <div class="module-body"><h3>Luyện nhìn → chọn cách đọc</h3><p>Xem chữ và chọn đúng phiên âm</p></div>
      </button>
      <button class="module-card" id="btn-quiz">
        <div class="module-glyph">📝</div>
        <div class="module-body">
          <h3>Kiểm tra tổng hợp (${(idx + 1) * 10} câu)</h3>
          <p>${idx === 0 ? 'Chỉ trong nhóm này' : `Ôn lại cả ${idx + 1} nhóm đã học`}${isLast ? '' : ' · đạt ≥80% để mở khóa nhóm tiếp theo'}</p>
        </div>
      </button>
      ${moduleId === 'syllables' ? `
      <button class="module-card" id="btn-builder">
        <div class="module-glyph">🧩</div>
        <div class="module-body">
          <h3>Ghép chữ tự do</h3>
          <p>Tự chọn phụ âm + nguyên âm (+ batchim) để ghép thành âm tiết bất kỳ</p>
        </div>
      </button>` : ''}
    </div>
  `;
}
function attachModuleHome(moduleId) {
  document.getElementById('btn-back-home').addEventListener('click', () => navigate('home'));
  document.getElementById('btn-learn').addEventListener('click', () => navigate('learn', { moduleId, index: 0 }));
  document.getElementById('btn-practice-listen').addEventListener('click', () => startSession(moduleId, 'listen'));
  document.getElementById('btn-practice-look').addEventListener('click', () => startSession(moduleId, 'look'));
  document.getElementById('btn-quiz').addEventListener('click', () => startSession(moduleId, 'quiz'));
  const builderBtn = document.getElementById('btn-builder');
  if (builderBtn) builderBtn.addEventListener('click', () => navigate('builder', { moduleId }));
}

// ============ LEARN (flashcard) ============
let traceVisible = false;

function learnHTML(moduleId, index) {
  const m = getModule(moduleId);
  const letter = m.letters[index];
  const mp = ensureModuleProgress(moduleId);
  const isLearned = mp.learned.includes(index);
  const isLast = index === m.letters.length - 1;
  const breakdown = explainComposition(letter.char);

  const dots = m.letters.map((_, i) => {
    const cls = ['flash-dot'];
    if (mp.learned.includes(i)) cls.push('learned');
    if (i === index) cls.push('active');
    return `<button class="${cls.join(' ')}" data-index="${i}" title="Chữ ${i + 1}"></button>`;
  }).join('');

  return `
    <div class="back-row"><button class="btn btn-ghost" id="btn-back-module">← ${m.title}</button></div>
    <div class="flash-progress">Chữ ${index + 1} / ${m.letters.length}</div>

    <div class="learn-layout">
      <div class="learn-main">
        <div class="flashcard">
          <div class="flash-char">${letter.char}</div>
          <div class="flash-roman">${letter.romanization}</div>
          <div class="flash-hint">${letter.hint}</div>
          <div class="flash-example">
            <span class="ex-word">${letter.example.word}</span>
            <span class="ex-roman">${letter.example.romanization}</span>
            <span class="ex-meaning">nghĩa: ${letter.example.meaning}</span>
          </div>
          ${breakdownHTML(breakdown)}
          <div class="flash-actions">
            <button class="btn btn-primary" id="btn-speak">🔊 Nghe phát âm</button>
            <button class="btn" id="btn-speak-slow">🐢 Nghe chậm từng âm</button>
            <button class="btn ${isLearned ? '' : 'btn-primary'}" id="btn-toggle-learned">
              ${isLearned ? '✓ Đã học (bấm để bỏ)' : '＋ Đánh dấu đã học'}
            </button>
            <button class="btn" id="btn-toggle-trace">${traceVisible ? '✏️ Ẩn tập viết' : '✏️ Tập viết'}</button>
          </div>
        </div>

        <div class="flash-nav">
          <button class="btn" id="btn-prev" ${index === 0 ? 'disabled' : ''}>← Trước</button>
          <div class="flash-dots">${dots}</div>
          <button class="btn btn-primary" id="btn-next">${isLast ? 'Hoàn tất →' : 'Tiếp →'}</button>
        </div>
      </div>

      ${traceVisible ? `
      <div class="learn-side">
        <div class="trace-wrap">
          <h4>✏️ Tập viết theo nét mờ</h4>
          <canvas id="trace-canvas" width="220" height="220"></canvas>
          <div class="trace-actions">
            <button class="btn" id="btn-trace-clear">Xóa nét</button>
          </div>
        </div>
      </div>` : ''}
    </div>
  `;
}
function attachLearn(moduleId, index) {
  const m = getModule(moduleId);
  const letter = m.letters[index];
  const mp = ensureModuleProgress(moduleId);

  document.getElementById('btn-back-module').addEventListener('click', () => navigate('moduleHome', { moduleId }));
  document.getElementById('btn-speak').addEventListener('click', () => speak(letter.audioText));
  document.getElementById('btn-speak-slow').addEventListener('click', () => speakSlow(letter.example.word));
  document.getElementById('btn-toggle-learned').addEventListener('click', () => {
    const i = mp.learned.indexOf(index);
    if (i === -1) mp.learned.push(index); else mp.learned.splice(i, 1);
    saveProgress();
    navigate('learn', { moduleId, index });
  });
  document.getElementById('btn-toggle-trace').addEventListener('click', () => {
    traceVisible = !traceVisible;
    navigate('learn', { moduleId, index });
  });
  document.getElementById('btn-prev').addEventListener('click', () => {
    if (index > 0) navigate('learn', { moduleId, index: index - 1 });
  });
  document.getElementById('btn-next').addEventListener('click', () => {
    if (index < m.letters.length - 1) navigate('learn', { moduleId, index: index + 1 });
    else navigate('moduleHome', { moduleId });
  });
  document.querySelectorAll('.flash-dot').forEach(dot => {
    dot.addEventListener('click', () => navigate('learn', { moduleId, index: Number(dot.dataset.index) }));
  });

  if (traceVisible) {
    setupTraceCanvas(letter.char);
    document.getElementById('btn-trace-clear').addEventListener('click', () => drawTraceGuide(letter.char));
  }

  // Tự động phát âm khi mở thẻ mới
  speak(letter.audioText);
}

let traceCtx = null, traceDrawing = false, traceLast = null;
function setupTraceCanvas(char) {
  const canvas = document.getElementById('trace-canvas');
  traceCtx = canvas.getContext('2d');
  drawTraceGuide(char);

  function getPos(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const point = evt.touches ? evt.touches[0] : evt;
    return { x: (point.clientX - rect.left) * scaleX, y: (point.clientY - rect.top) * scaleY };
  }
  canvas.addEventListener('pointerdown', (e) => {
    traceDrawing = true;
    traceLast = getPos(e);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!traceDrawing) return;
    const p = getPos(e);
    traceCtx.strokeStyle = '#22252a';
    traceCtx.lineWidth = 8;
    traceCtx.lineCap = 'round';
    traceCtx.lineJoin = 'round';
    traceCtx.beginPath();
    traceCtx.moveTo(traceLast.x, traceLast.y);
    traceCtx.lineTo(p.x, p.y);
    traceCtx.stroke();
    traceLast = p;
  });
  canvas.addEventListener('pointerup', () => { traceDrawing = false; });
  canvas.addEventListener('pointerleave', () => { traceDrawing = false; });
}
function drawTraceGuide(char) {
  const canvas = document.getElementById('trace-canvas');
  if (!canvas || !traceCtx) return;
  traceCtx.fillStyle = '#ffffff';
  traceCtx.fillRect(0, 0, canvas.width, canvas.height);
  traceCtx.font = '155px "Malgun Gothic", sans-serif';
  traceCtx.fillStyle = '#e2e2e2';
  traceCtx.textAlign = 'center';
  traceCtx.textBaseline = 'middle';
  traceCtx.fillText(char, canvas.width / 2, canvas.height / 2 + 10);
}

// ============ PRACTICE / QUIZ SESSION ============
// Trả về mảng độ dài `count`, xoay vòng qua các phần tử đã xáo trộn khi count > số phần tử,
// tránh lặp lại ngay ở ranh giới giữa 2 vòng.
function sampleWithRepeat(items, count) {
  const result = [];
  while (result.length < count) {
    const batch = shuffle(items);
    if (result.length > 0 && batch.length > 1 && batch[0] === result[result.length - 1]) {
      [batch[0], batch[1]] = [batch[1], batch[0]];
    }
    result.push(...batch);
  }
  return result.slice(0, count);
}

// Luyện tập (nghe/nhìn): chỉ trong phạm vi module hiện tại, 30 câu (xoay vòng nếu module ít chữ).
// Kiểm tra tổng hợp: tích lũy toàn bộ các module từ đầu đến module hiện tại, số câu tăng dần
// theo cấp số 10 mỗi module (module 1 = 10 câu, module 2 = 20 câu, ...), để càng học lên cao
// càng phải ôn lại kiến thức cũ — độ khó tăng dần.
function buildLetterPool(moduleId, mode) {
  const targetIdx = getModuleIndex(moduleId);
  if (mode === 'quiz') {
    const pool = [];
    for (let i = 0; i <= targetIdx; i++) {
      MODULES[i].letters.forEach((letter, li) => pool.push({ moduleId: MODULES[i].id, letterIndex: li, letter }));
    }
    return pool;
  }
  const mod = getModule(moduleId);
  return mod.letters.map((letter, li) => ({ moduleId: mod.id, letterIndex: li, letter }));
}

function startSession(moduleId, mode) {
  const idx = getModuleIndex(moduleId);
  const pool = buildLetterPool(moduleId, mode);
  const count = mode === 'quiz' ? (idx + 1) * 10 : 30;
  const chosen = sampleWithRepeat(pool, count);

  const questions = chosen.map(entry => {
    const qType = mode === 'quiz' ? (Math.random() < 0.5 ? 'listen' : 'look') : mode;
    const correct = entry.letter;
    const correctValue = qType === 'listen' ? correct.char : correct.romanization;
    const seenValues = new Set([correctValue]);
    const distractors = [];
    for (const p of shuffle(pool)) {
      if (p.moduleId === entry.moduleId && p.letterIndex === entry.letterIndex) continue;
      const val = qType === 'listen' ? p.letter.char : p.letter.romanization;
      if (seenValues.has(val)) continue;
      seenValues.add(val);
      distractors.push(p.letter);
      if (distractors.length === 3) break;
    }
    const optionPool = shuffle([correct, ...distractors]);
    return {
      moduleId: entry.moduleId,
      letterIndex: entry.letterIndex,
      qType,
      choices: optionPool.map(l => ({
        value: qType === 'listen' ? l.char : l.romanization,
        isCorrect: l === correct,
      })),
    };
  });

  session = { moduleId, mode, questions, index: 0, correctCount: 0, answered: false };
  navigate('practice');
}

function finalizeSession() {
  const percent = Math.round((session.correctCount / session.questions.length) * 100);
  session.percent = percent;
  if (session.mode === 'quiz') {
    const mp = ensureModuleProgress(session.moduleId);
    mp.quizBest = Math.max(mp.quizBest || 0, percent);
    if (percent >= 80) mp.quizPassed = true;
    saveProgress();
  }
}

function practiceHTML() {
  const moduleTitle = getModule(session.moduleId).title;
  const q = session.questions[session.index];
  const letter = getModule(q.moduleId).letters[q.letterIndex];
  const modeLabel = session.mode === 'quiz' ? 'Kiểm tra tổng hợp' : (session.mode === 'listen' ? 'Luyện nghe' : 'Luyện nhìn');
  const pct = Math.round((session.index / session.questions.length) * 100);

  const choicesHTML = q.choices.map((c, i) => `
    <button class="choice-btn ${q.qType === 'look' ? 'roman-choice' : ''}" data-index="${i}">${c.value}</button>
  `).join('');

  let promptHTML;
  if (q.qType === 'listen') {
    promptHTML = `
      <p class="question-instruction">Nghe âm thanh và chọn đúng chữ cái</p>
      <button class="question-audio-btn" id="btn-play-audio">🔊</button>
    `;
  } else {
    promptHTML = `
      <div class="question-prompt-char">${letter.char}</div>
      <p class="question-instruction">Chữ này đọc là gì?</p>
    `;
  }

  return `
    <div class="back-row"><button class="btn btn-ghost" id="btn-back-module">← ${moduleTitle}</button></div>
    <div class="practice-progress">
      <span>${modeLabel} · Câu ${session.index + 1}/${session.questions.length}</span>
      <div class="header-progress-bar"><div class="header-progress-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="question-card">
      ${promptHTML}
      <div class="choice-grid">${choicesHTML}</div>
      <div id="feedback-area"></div>
    </div>
  `;
}
function attachPractice() {
  const q = session.questions[session.index];
  const letter = getModule(q.moduleId).letters[q.letterIndex];

  document.getElementById('btn-back-module').addEventListener('click', () => navigate('moduleHome', { moduleId: session.moduleId }));

  if (q.qType === 'listen') {
    const playBtn = document.getElementById('btn-play-audio');
    playBtn.addEventListener('click', () => speak(letter.audioText));
    speak(letter.audioText);
  }

  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => handleAnswer(Number(btn.dataset.index)));
  });
}
function handleAnswer(choiceIndex) {
  if (session.answered) return;
  session.answered = true;
  const q = session.questions[session.index];
  const letter = getModule(q.moduleId).letters[q.letterIndex];
  const chosen = q.choices[choiceIndex];
  const correct = chosen.isCorrect;

  if (correct) {
    session.correctCount++;
    const mp = ensureModuleProgress(q.moduleId);
    if (!mp.learned.includes(q.letterIndex)) mp.learned.push(q.letterIndex);
    saveProgress();
    updateHeaderProgress();
  }

  document.querySelectorAll('.choice-btn').forEach((btn, i) => {
    btn.disabled = true;
    if (q.choices[i].isCorrect) btn.classList.add('correct');
    else if (i === choiceIndex) btn.classList.add('wrong');
  });

  const feedback = document.getElementById('feedback-area');
  const isLast = session.index === session.questions.length - 1;
  feedback.innerHTML = `
    <div class="feedback-banner ${correct ? 'correct' : 'wrong'}">
      ${correct ? 'Chính xác! 🎉' : `Chưa đúng. Đáp án: ${letter.char} (${letter.romanization}) — ví dụ: ${letter.example.word} (${letter.example.meaning})`}
    </div>
    <div class="btn-row" style="justify-content:center;">
      <button class="btn btn-primary btn-lg" id="btn-next-question">${isLast ? 'Xem kết quả →' : 'Câu tiếp theo →'}</button>
    </div>
  `;
  document.getElementById('btn-next-question').addEventListener('click', () => {
    session.index++;
    if (session.index >= session.questions.length) {
      finalizeSession();
      navigate('result');
    } else {
      session.answered = false;
      render();
    }
  });
}

// ============ RESULT ============
function resultHTML() {
  const m = getModule(session.moduleId);
  const idx = getModuleIndex(session.moduleId);
  const nextModule = MODULES[idx + 1];
  const isQuiz = session.mode === 'quiz';
  const passed = session.percent >= 80;

  let statusHTML = '';
  if (isQuiz) {
    statusHTML = passed
      ? `<p class="result-pass">✓ Đạt yêu cầu (≥80%)</p>`
      : `<p class="result-fail">Chưa đạt — cần ≥80% để mở khóa nhóm tiếp theo</p>`;
  }

  let unlockBtn = '';
  if (isQuiz && passed && nextModule) {
    unlockBtn = `<button class="btn btn-primary btn-lg" id="btn-next-module">🔓 Mở khóa: ${nextModule.title} →</button>`;
  }

  return `
    <div class="result-card">
      <div class="result-score">${session.percent}%</div>
      <p class="result-label">Đúng ${session.correctCount}/${session.questions.length} câu — ${m.title}</p>
      ${statusHTML}
      <div class="btn-row" style="justify-content:center;">
        <button class="btn" id="btn-retry">Làm lại</button>
        <button class="btn" id="btn-to-module">Về nhóm</button>
        ${unlockBtn}
      </div>
    </div>
  `;
}
function attachResult() {
  document.getElementById('btn-retry').addEventListener('click', () => startSession(session.moduleId, session.mode));
  document.getElementById('btn-to-module').addEventListener('click', () => navigate('moduleHome', { moduleId: session.moduleId }));
  const nextBtn = document.getElementById('btn-next-module');
  if (nextBtn) {
    const idx = getModuleIndex(session.moduleId);
    const nextModule = MODULES[idx + 1];
    nextBtn.addEventListener('click', () => navigate('moduleHome', { moduleId: nextModule.id }));
  }
}

// ============ SYLLABLE BUILDER ============
function chipRow(list, selected, group) {
  return list.map(v => {
    const label = v === '' ? 'Không có' : v;
    const active = v === selected ? 'active' : '';
    return `<button class="chip ${active}" data-group="${group}" data-value="${v}">${label}</button>`;
  }).join('');
}
function builderHTML(moduleId) {
  const { initial, medial, final } = builderState;
  const composed = composeHangul(initial, medial, final);
  const roman = romanizeCombo(initial, medial, final);
  const breakdown = explainComposition(composed);

  return `
    <div class="back-row"><button class="btn btn-ghost" id="btn-back-module">← Ghép âm tiết</button></div>
    <h2 class="view-title">🧩 Ghép chữ tự do</h2>
    <p class="view-sub">Chọn phụ âm đầu, nguyên âm, và (tuỳ chọn) phụ âm cuối để xem chữ ghép ra.</p>

    <div class="builder-preview">
      <div class="flash-char">${composed}</div>
      <div class="flash-roman">${roman || '—'}</div>
      <div class="flash-actions">
        <button class="btn btn-primary" id="btn-builder-speak">🔊 Nghe thử</button>
        <button class="btn" id="btn-builder-random">🎲 Ngẫu nhiên</button>
      </div>
      ${breakdownHTML(breakdown)}
      <p class="builder-note">Phiên âm chỉ mang tính minh họa, một số tổ hợp không phải từ có nghĩa.</p>
    </div>

    <div class="builder-section">
      <h4>Phụ âm đầu (초성)</h4>
      <div class="chip-grid">${chipRow(INITIAL_LIST, initial, 'initial')}</div>
    </div>
    <div class="builder-section">
      <h4>Nguyên âm (중성)</h4>
      <div class="chip-grid">${chipRow(MEDIAL_LIST, medial, 'medial')}</div>
    </div>
    <div class="builder-section">
      <h4>Phụ âm cuối / Batchim (종성, tuỳ chọn)</h4>
      <div class="chip-grid">${chipRow(FINAL_LIST, final, 'final')}</div>
    </div>
  `;
}
function attachBuilder(moduleId) {
  const { initial, medial, final } = builderState;
  const composed = composeHangul(initial, medial, final);

  document.getElementById('btn-back-module').addEventListener('click', () => navigate('moduleHome', { moduleId }));
  document.getElementById('btn-builder-speak').addEventListener('click', () => speak(composed));
  document.getElementById('btn-builder-random').addEventListener('click', () => {
    builderState = {
      initial: INITIAL_LIST[Math.floor(Math.random() * INITIAL_LIST.length)],
      medial: MEDIAL_LIST[Math.floor(Math.random() * MEDIAL_LIST.length)],
      final: Math.random() < 0.5 ? '' : FINAL_LIST[Math.floor(Math.random() * FINAL_LIST.length)],
    };
    render();
  });
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      builderState[chip.dataset.group] = chip.dataset.value;
      render();
    });
  });

  speak(composed);
}

// ============ VOCAB (Từ vựng đời sống) ============
function vocabHomeHTML() {
  const cards = VOCAB_TOPICS.map(t => `
    <button class="module-card" data-topic="${t.id}">
      <div class="module-glyph">${t.icon}</div>
      <div class="module-body">
        <h3>${t.title}</h3>
        <p>${t.words.length} từ / cụm từ</p>
      </div>
    </button>
  `).join('');

  return `
    <h1 class="home-title">Từ vựng đời sống</h1>
    <p class="home-sub">10 chủ điểm tiếng Hàn dùng trong sinh hoạt hằng ngày, kèm cách sử dụng thực tế.</p>
    <div class="module-grid">${cards}</div>
  `;
}
function attachVocabHome() {
  document.querySelectorAll('#app .module-card').forEach(btn => {
    btn.addEventListener('click', () => navigate('vocabTopic', { topicId: btn.dataset.topic }));
  });
}

function vocabTopicHTML(topicId) {
  const topic = VOCAB_TOPICS.find(t => t.id === topicId);
  const wordsHTML = topic.words.map((w, i) => `
    <div class="vocab-card">
      <div class="vocab-card-head">
        <div>
          <div class="vocab-word">${w.korean}</div>
          <div class="vocab-roman">${w.romanization}</div>
        </div>
        <button class="vocab-audio-btn" data-index="${i}" title="Nghe phát âm">🔊</button>
      </div>
      <p class="vocab-meaning">${w.meaning}</p>
      <p class="vocab-usage">💡 ${w.usage}</p>
    </div>
  `).join('');

  const sentencesHTML = topic.sentences.map((s, i) => `
    <div class="vocab-card">
      <div class="vocab-card-head">
        <div>
          <div class="vocab-word">${s.korean}</div>
          <div class="vocab-roman">${s.romanization}</div>
        </div>
        <button class="sentence-audio-btn" data-index="${i}" title="Nghe phát âm">🔊</button>
      </div>
      <p class="vocab-meaning">${s.meaning}</p>
      <p class="grammar-note">📐 ${s.grammar}</p>
    </div>
  `).join('');

  return `
    <div class="back-row"><button class="btn btn-ghost" id="btn-back-vocab">← Từ vựng đời sống</button></div>
    <h2 class="view-title">${topic.icon} ${topic.title}</h2>
    <p class="view-sub">${topic.words.length} từ / cụm từ · ${topic.sentences.length} câu thường dùng</p>

    <h3 class="section-subtitle">📖 Từ vựng</h3>
    <div class="vocab-list">${wordsHTML}</div>

    <h3 class="section-subtitle">🗣️ Câu thường dùng</h3>
    <div class="vocab-list">${sentencesHTML}</div>
  `;
}
function attachVocabTopic(topicId) {
  const topic = VOCAB_TOPICS.find(t => t.id === topicId);
  document.getElementById('btn-back-vocab').addEventListener('click', () => navigate('vocabHome'));
  document.querySelectorAll('.vocab-audio-btn').forEach(btn => {
    btn.addEventListener('click', () => speak(topic.words[Number(btn.dataset.index)].korean));
  });
  document.querySelectorAll('.sentence-audio-btn').forEach(btn => {
    btn.addEventListener('click', () => speak(topic.sentences[Number(btn.dataset.index)].korean));
  });
}

// ============ RENDER DISPATCH ============
function render() {
  const app = document.getElementById('app');
  switch (state.view) {
    case 'home':
      app.innerHTML = homeHTML(); attachHome(); break;
    case 'moduleHome':
      app.innerHTML = moduleHomeHTML(state.params.moduleId); attachModuleHome(state.params.moduleId); break;
    case 'learn':
      app.innerHTML = learnHTML(state.params.moduleId, state.params.index); attachLearn(state.params.moduleId, state.params.index); break;
    case 'practice':
      app.innerHTML = practiceHTML(); attachPractice(); break;
    case 'result':
      app.innerHTML = resultHTML(); attachResult(); break;
    case 'builder':
      app.innerHTML = builderHTML(state.params.moduleId); attachBuilder(state.params.moduleId); break;
    case 'vocabHome':
      app.innerHTML = vocabHomeHTML(); attachVocabHome(); break;
    case 'vocabTopic':
      app.innerHTML = vocabTopicHTML(state.params.topicId); attachVocabTopic(state.params.topicId); break;
  }
  updateHeaderProgress();
  updateTabBar();
  window.scrollTo(0, 0);
}
function updateTabBar() {
  document.getElementById('tab-hangul').classList.toggle('active', HANGUL_VIEWS.has(state.view));
  document.getElementById('tab-vocab').classList.toggle('active', VOCAB_VIEWS.has(state.view));
}

// ============ INIT ============
document.getElementById('btn-home').addEventListener('click', () => navigate('home'));
document.getElementById('tab-hangul').addEventListener('click', () => navigate('home'));
document.getElementById('tab-vocab').addEventListener('click', () => navigate('vocabHome'));

// ---- Settings panel (tốc độ đọc) ----
const settingsBtn = document.getElementById('btn-settings');
const settingsPanel = document.getElementById('settings-panel');
const rateSlider = document.getElementById('speech-rate-slider');
const rateValueLabel = document.getElementById('speech-rate-value');

function refreshRateLabel(val) { rateValueLabel.textContent = parseFloat(val).toFixed(2) + 'x'; }
rateSlider.value = speechRate;
refreshRateLabel(speechRate);

settingsBtn.addEventListener('click', () => {
  settingsPanel.hidden = !settingsPanel.hidden;
});
document.addEventListener('click', (e) => {
  if (!settingsPanel.hidden && !settingsPanel.contains(e.target) && e.target !== settingsBtn) {
    settingsPanel.hidden = true;
  }
});
rateSlider.addEventListener('input', () => refreshRateLabel(rateSlider.value));
rateSlider.addEventListener('change', () => {
  speechRate = parseFloat(rateSlider.value);
  saveSpeechRate();
});
document.getElementById('btn-speed-test').addEventListener('click', () => {
  speechRate = parseFloat(rateSlider.value);
  saveSpeechRate();
  refreshRateLabel(speechRate);
  speak('안녕하세요');
});

render();
