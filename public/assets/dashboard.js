// showmelove — Dashboard (data is server-rendered; this handles UI affordances)

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// Copy link
const copyBtn = $('#copyBtn');
if (copyBtn) {
  copyBtn.addEventListener('click', () => {
    const label = $('#copyLabel');
    const url = copyBtn.dataset.url || '';
    if (navigator.clipboard && url) navigator.clipboard.writeText(url).catch(() => {});
    const prev = label.textContent;
    label.textContent = 'Copied!';
    setTimeout(() => { label.textContent = prev; }, 1400);
  });
}

// Dismiss upgrade nudge
const nudgeClose = $('#nudgeClose');
if (nudgeClose) {
  nudgeClose.addEventListener('click', () => $('#nudge').classList.add('is-hidden'));
}
