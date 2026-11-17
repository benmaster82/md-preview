const main = document.getElementById('main');
const rawEl = document.getElementById('raw');
const srcEl = document.getElementById('src');
const gutterEl = document.getElementById('gutter');
const renEl = document.getElementById('rendered');
const mdEl = document.getElementById('md');
const statusEl = document.getElementById('status');
const findEl = document.getElementById('find');
const findQ = document.getElementById('find-q');
const findN = document.getElementById('find-n');

function setMode(m) {
  main.className = m;
  document.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  try { localStorage.setItem('mdp-mode', m); } catch (e) {}
  showMatch(true);
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
  markRendered();
}

// The gutter mirrors the text line by line so its numbers wrap exactly like the textarea.
// It also carries the find highlights, which show through the transparent textarea.
function syncGutter() {
  const q = query();
  gutterEl.innerHTML = srcEl.value.split('\n').map(l => {
    let html = '', at = 0;
    for (const i of matchesIn(l, q)) {
      html += esc(l.slice(at, i)) + '<mark class="hit">' + esc(l.slice(i, i + q.length)) + '</mark>';
      at = i + q.length;
    }
    return '<span class="l">' + (html + esc(l.slice(at)) || ' ') + '</span>';
  }).join('');
  showMatch(false);
}

// --- Find --------------------------------------------------------------------------------------
// Matches are highlighted in both panes; the source pane drives navigation unless it is hidden.
let findIdx = 0;
function findOpen() { return !findEl.hidden; }
function query() { return findOpen() ? findQ.value.toLowerCase() : ''; }
function srcPrimary() { return main.className !== 'ren-only'; }

function matchesIn(text, q) {
  const out = [];
  if (!q) return out;
  text = text.toLowerCase();
  for (let i = text.indexOf(q); i >= 0; i = text.indexOf(q, i + q.length)) out.push(i);
  return out;
}

function markRendered() {
  mdEl.querySelectorAll('mark.hit').forEach(m => m.replaceWith(m.textContent));
  mdEl.normalize();
  const q = query();
  if (q) {
    const w = document.createTreeWalker(mdEl, NodeFilter.SHOW_TEXT), nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    for (const n of nodes) {
      const t = n.nodeValue, hits = matchesIn(t, q);
      if (!hits.length) continue;
      const f = document.createDocumentFragment();
      let at = 0;
      for (const i of hits) {
        const m = document.createElement('mark');
        m.className = 'hit';
        m.textContent = t.slice(i, i + q.length);
        f.append(t.slice(at, i), m);
        at = i + q.length;
      }
      f.append(t.slice(at));
      n.replaceWith(f);
    }
  }
  showMatch(false);
}

function showMatch(scroll) {
  if (!findOpen()) return;
  const hits = (srcPrimary() ? gutterEl : mdEl).querySelectorAll('mark.hit');
  if (findIdx >= hits.length) findIdx = 0;
  findN.textContent = !findQ.value ? '' : hits.length ? `${findIdx + 1}/${hits.length}` : 'no results';
  document.querySelectorAll('mark.cur').forEach(m => m.classList.remove('cur'));
  const m = hits[findIdx];
  if (!m) return;
  m.classList.add('cur');
  if (!scroll) return;
  m.scrollIntoView({ block: 'center' });
  // Select it in the editor too, so closing the bar leaves the caret on the match.
  if (srcPrimary()) {
    const at = matchesIn(srcEl.value, query())[findIdx];
    srcEl.setSelectionRange(at, at + findQ.value.length);
  }
}

function runFind() {
  // Start from the first match at or after the caret.
  const after = srcPrimary() ? matchesIn(srcEl.value, query()).findIndex(i => i >= srcEl.selectionStart) : 0;
  findIdx = Math.max(after, 0);
  syncGutter();
  markRendered();
  showMatch(true);
}

function openFind() {
  if (document.body.classList.contains('is-empty')) return;
  const sel = srcEl.value.slice(srcEl.selectionStart, srcEl.selectionEnd);
  if (document.activeElement === srcEl && sel && !sel.includes('\n')) findQ.value = sel;
  findEl.hidden = false;
  findQ.focus();
  findQ.select();
  runFind();
}

function findStep(d) {
  if (!findOpen()) return openFind();
  const n = (srcPrimary() ? gutterEl : mdEl).querySelectorAll('mark.hit').length;
  if (!n) return;
  findIdx = (findIdx + d + n) % n;
  showMatch(true);
}

function closeFind() {
  findEl.hidden = true;
  syncGutter();
  markRendered();
  if (srcPrimary()) srcEl.focus({ preventScroll: true });
}

findQ.addEventListener('input', runFind);
findQ.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  findStep(e.shiftKey ? -1 : 1);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && findOpen()) { e.preventDefault(); closeFind(); }
});
document.getElementById('find-prev').onclick = () => findStep(-1);
document.getElementById('find-next').onclick = () => findStep(1);
document.getElementById('find-close').onclick = closeFind;

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
  const keys = {
    s: () => save(false), o: pickFile, f: openFind, g: () => findStep(1), G: () => findStep(-1),
    1: () => setMode(''), 2: () => setMode('raw-only'), 3: () => setMode('ren-only'),
  };
  document.addEventListener('keydown', e => {
    const act = keys[e.shiftKey ? e.key.toUpperCase() : e.key.toLowerCase()];
    if (!act || !e.ctrlKey || e.altKey) return;
    e.preventDefault();
    act();
  });
}
if (!navigator.userAgent.includes('Mac')) {
  const open = document.getElementById('open'), hint = document.querySelector('#empty small');
  open.title = open.title.replace('⌘', 'Ctrl+');
  document.querySelectorAll('#find button').forEach(b => b.title = b.title.replace('⌘', 'Ctrl+'));
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
