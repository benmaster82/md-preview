const main = document.getElementById('main');
const rawEl = document.getElementById('raw');
const srcEl = document.getElementById('src');
const gutterEl = document.getElementById('gutter');
const renEl = document.getElementById('rendered');
const mdEl = document.getElementById('md');
const statusEl = document.getElementById('status');

function setMode(m) {
  main.className = m;
  document.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  try { localStorage.setItem('mdp-mode', m); } catch (e) {}
}
document.querySelectorAll('.seg button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
let savedMode = ''; try { savedMode = localStorage.getItem('mdp-mode') || ''; } catch (e) {}
setMode(savedMode);

const post = msg => window.ipc.postMessage(msg);
const pickFile = () => post('open');
document.getElementById('open').onclick = pickFile;
document.getElementById('empty').onclick = pickFile;

const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const slug = s => s.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-');

// In-page anchors (#section) would otherwise resolve against <base> and navigate away.
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  e.preventDefault();
  const t = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
  if (t) t.scrollIntoView();
});

function setStatus(text, warn = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('warn', warn);
}

function showHtml(html) {
  mdEl.innerHTML = html;
  const seen = {};
  mdEl.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
    if (h.id) return;
    let id = slug(h.textContent); const n = seen[id] = (seen[id] || 0) + 1;
    h.id = n > 1 ? `${id}-${n - 1}` : id;
  });
  mdEl.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
}

// The gutter mirrors the text line by line so its numbers wrap exactly like the textarea.
function syncGutter() {
  gutterEl.innerHTML = srcEl.value.split('\n').map(l => '<span class="l">' + (esc(l) || ' ') + '</span>').join('');
}

// --- Editing ---------------------------------------------------------------------------------
let dirty = false;
let renderTimer = 0, renderSeq = 0;

function setDirty(d) {
  if (d === dirty) return;
  dirty = d;
  post('dirty:' + (d ? '1' : '0'));
}

async function renderLive() {
  const seq = ++renderSeq;
  try {
    const r = await fetch('/__mdp/render', { method: 'POST', body: srcEl.value, cache: 'no-store' });
    const d = await r.json();
    if (seq !== renderSeq) return; // a newer edit already started rendering
    const keep = renEl.scrollTop;
    showHtml(d.html);
    renEl.scrollTop = keep;
  } catch (e) {
    setStatus('preview error: ' + e, true);
  }
}

srcEl.addEventListener('input', () => {
  syncGutter();
  setDirty(true);
  setStatus('edited');
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderLive, 120);
});

// Tab indents instead of leaving the editor. execCommand keeps native undo working.
srcEl.addEventListener('keydown', e => {
  if (e.key !== 'Tab' || e.metaKey || e.ctrlKey || e.altKey) return;
  e.preventDefault();
  if (!e.shiftKey) document.execCommand('insertText', false, '  ');
});

// Called from the native side (⌘S, or "Save" when closing with unsaved changes).
function save(close) {
  post((close ? 'save-close:' : 'save:') + srcEl.value);
}
function saved() {
  dirty = false;
  setStatus('saved ' + new Date().toLocaleTimeString());
}

// WebView2 keeps key presses to itself, so the menu's shortcuts never fire on Windows: handle them here.
if (navigator.userAgent.includes('Windows')) {
  const keys = { s: () => save(false), o: pickFile, 1: () => setMode(''), 2: () => setMode('raw-only'), 3: () => setMode('ren-only') };
  document.addEventListener('keydown', e => {
    const act = keys[e.key.toLowerCase()];
    if (!act || !e.ctrlKey || e.altKey || e.shiftKey) return;
    e.preventDefault();
    act();
  });
}
if (!navigator.userAgent.includes('Mac')) {
  const open = document.getElementById('open'), hint = document.querySelector('#empty small');
  open.title = open.title.replace('⌘', 'Ctrl+');
  hint.textContent = hint.textContent.replace('⌘', 'Ctrl+');
}

// --- Loading from disk -------------------------------------------------------------------------
async function refresh() {
  try {
    const d = await (await fetch('/__mdp/content', { cache: 'no-store' })).json();
    document.body.classList.toggle('is-empty', !!d.empty);
    if (d.empty) { setStatus(''); return; }
    if (d.error) { setStatus(d.error, true); return; }
    document.querySelector('base').href = d.base;
    // Never overwrite unsaved edits with the version on disk.
    if (dirty) { setStatus('file changed on disk; saving will overwrite it', true); return; }
    const keep = [rawEl.scrollTop, renEl.scrollTop];
    if (srcEl.value !== d.raw) {
      const [a, b] = [srcEl.selectionStart, srcEl.selectionEnd];
      srcEl.value = d.raw;
      srcEl.setSelectionRange(a, b);
      syncGutter();
    }
    showHtml(d.html);
    [rawEl.scrollTop, renEl.scrollTop] = keep;
    setStatus('updated ' + new Date().toLocaleTimeString());
  } catch (e) {
    setStatus('error: ' + e, true);
  }
}
refresh();
