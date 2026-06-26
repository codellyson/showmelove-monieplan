// showmelove — Setup Flow
// Faithful implementation of "Showmelove - Setup Flow.dc.html"

const RAIL = [
  { label: 'Claim your page', sub: 'Name and link' },
  { label: 'Make it yours',   sub: 'Photo, bio, goal' },
  { label: 'Get paid',        sub: 'Choose a payout mode' },
];

const state = {
  step: 1,        // 1..4 (4 = finish)
  payMode: 'managed', // 'managed' | 'byo'
};

const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const railEl    = $('#railSteps');
const navEl     = $('#nav');
const backEl    = $('#back');
const nextEl    = $('#next');
const byoExpand = $('#byoExpand');

function renderRail() {
  railEl.innerHTML = '';
  RAIL.forEach((item, idx) => {
    const i = idx + 1;
    const active = state.step === i;
    const done = state.step > i || state.step === 4;

    const row = document.createElement('div');
    row.className = 'rail-item' + (active ? ' is-active' : '') + (done && !active ? ' is-done' : '');

    const num = document.createElement('div');
    num.className = 'rail-num';
    num.textContent = (done && !active) ? '✓' : String(i);

    const text = document.createElement('div');
    const lab = document.createElement('div');
    lab.className = 'rail-label';
    lab.textContent = item.label;
    const sub = document.createElement('div');
    sub.className = 'rail-sub';
    sub.textContent = item.sub;
    text.append(lab, sub);

    row.append(num, text);
    railEl.appendChild(row);
  });
}

function renderSteps() {
  $$('.step').forEach((el) => {
    el.classList.toggle('is-active', Number(el.dataset.step) === state.step);
  });
}

function renderPay() {
  const managed = state.payMode === 'managed';
  $('#optManaged').classList.toggle('is-selected', managed);
  $('#optByo').classList.toggle('is-selected', !managed);
  // expanded connect buttons only when "bring your own" is selected
  byoExpand.toggleAttribute('data-show', !managed);
}

function renderNav() {
  const showNav = state.step < 4;
  navEl.style.display = showNav ? 'flex' : 'none';
  backEl.style.display = (state.step > 1 && state.step < 4) ? '' : 'none';
  nextEl.textContent = state.step === 3 ? 'Finish' : 'Next';
}

function render() {
  renderRail();
  renderSteps();
  renderPay();
  renderNav();
}

function setState(patch) {
  Object.assign(state, patch);
  render();
}

// ---- Events ----
nextEl.addEventListener('click', () => setState({ step: Math.min(4, state.step + 1) }));
backEl.addEventListener('click', () => setState({ step: Math.max(1, state.step - 1) }));
$('#restart').addEventListener('click', () => setState({ step: 1, payMode: 'managed' }));

$('#optManaged').addEventListener('click', () => setState({ payMode: 'managed' }));
$('#optByo').addEventListener('click', () => setState({ payMode: 'byo' }));

// Don't trigger payout selection when clicking the inner connect buttons
$$('#byoExpand .btn-outline').forEach((b) =>
  b.addEventListener('click', (e) => e.stopPropagation())
);

// Copy link on finish screen
$('#copyLink').addEventListener('click', () => {
  const text = $('.finish-link-text').textContent.trim();
  if (navigator.clipboard) {
    navigator.clipboard.writeText('https://' + text).catch(() => {});
  }
});

render();
