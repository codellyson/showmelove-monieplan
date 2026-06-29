// showmelove — Setup Flow (persists to the signed-in user's creator on Finish)

const RAIL = [
  { label: 'Claim your page', sub: 'Name and link' },
  { label: 'Make it yours',   sub: 'Photo, bio, goal' },
  { label: 'Get paid',        sub: 'Choose a payout mode' },
];

const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const content   = $('.content');
const railEl    = $('#railSteps');
const navEl     = $('#nav');
const backEl    = $('#back');
const nextEl    = $('#next');
const byoExpand = $('#byoExpand');
const errEl     = $('#setupError');
const CSRF      = document.querySelector('meta[name="csrf-token"]')?.content || '';

const state = {
  step: 1,
  payMode: content.dataset.paymode === 'byo' ? 'byo' : 'managed',
};

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
  byoExpand.toggleAttribute('data-show', !managed);
}

function renderNav() {
  navEl.style.display = state.step < 4 ? 'flex' : 'none';
  backEl.style.display = (state.step > 1 && state.step < 4) ? '' : 'none';
  nextEl.textContent = state.step === 3 ? 'Finish' : 'Next';
  nextEl.disabled = false;
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

// Collect the wizard into a payload for the backend.
function collect() {
  return {
    displayName: $('#suName').value.trim(),
    handle: $('#suHandle').value.trim(),
    bio: $('#suBio').value.trim(),
    currency: $('#suCurrency').value,
    monthlyGoal: ($('#suGoal').value.match(/\d/g) || []).join(''),
    payoutMode: state.payMode,
  };
}

async function finish() {
  errEl.textContent = '';
  nextEl.disabled = true;
  nextEl.textContent = 'Saving…';
  try {
    const res = await fetch('/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': CSRF },
      body: JSON.stringify(collect()),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      errEl.textContent = data.error || 'Could not save. Check your details.';
      setState({ step: 1 });
      return;
    }
    // Reflect the saved handle on the finish screen.
    $('.finish-link-text').textContent = 'showmelove.com/' + data.handle;
    $('#viewPage').setAttribute('href', '/' + data.handle);
    setState({ step: 4 });
  } catch (e) {
    errEl.textContent = 'Network error. Please try again.';
    renderNav();
  }
}

// ---- Events ----
nextEl.addEventListener('click', () => {
  if (state.step === 3) finish();
  else setState({ step: Math.min(4, state.step + 1) });
});
backEl.addEventListener('click', () => setState({ step: Math.max(1, state.step - 1) }));
$('#restart').addEventListener('click', () => setState({ step: 1 }));

$('#optManaged').addEventListener('click', () => setState({ payMode: 'managed' }));
$('#optByo').addEventListener('click', () => setState({ payMode: 'byo' }));

$$('#byoExpand .btn-outline').forEach((b) =>
  b.addEventListener('click', (e) => e.stopPropagation())
);

$('#copyLink').addEventListener('click', () => {
  const text = $('.finish-link-text').textContent.trim();
  if (navigator.clipboard) navigator.clipboard.writeText('https://' + text).catch(() => {});
});

render();
