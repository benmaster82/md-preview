const main = document.getElementById('main');
const rawEl = document.getElementById('raw');
const renEl = document.getElementById('rendered');
const mdEl = document.getElementById('md');
const statusEl = document.getElementById('status');

function setMode(m) {
  main.className = m;
  document.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  try { localStorage.setItem('mdp-mode', m); } catch (e) {}
}
document.querySelectorAll('.seg button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
let saved = ''; try { saved = localStorage.getItem('mdp-mode') || ''; } catch (e) {}
setMode(saved);

const pickFile = () => window.ipc.postMessage('open');
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

async function refresh() {
  try {
    const d = await (await fetch('/__mdp/content', { cache: 'no-store' })).json();
    document.body.classList.toggle('is-empty', !!d.empty);
    if (d.empty) { statusEl.textContent = ''; return; }
    if (d.error) { statusEl.textContent = d.error; return; }
    document.querySelector('base').href = d.base;
    const keep = [rawEl.scrollTop, renEl.scrollTop];
    rawEl.innerHTML = d.raw.split('\n').map(l => '<span class="l">' + (esc(l) || ' ') + '</span>').join('');
    mdEl.innerHTML = d.html;
    const seen = {};
    mdEl.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
      if (h.id) return;
      let id = slug(h.textContent); const n = seen[id] = (seen[id] || 0) + 1;
      h.id = n > 1 ? `${id}-${n - 1}` : id;
    });
    mdEl.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
    [rawEl.scrollTop, renEl.scrollTop] = keep;
    statusEl.textContent = 'updated ' + new Date().toLocaleTimeString();
  } catch (e) {
    statusEl.textContent = 'error: ' + e;
  }
}
refresh();
