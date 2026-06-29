// showmelove — public Support Page (wired to AdonisJS backend)

const card = document.querySelector('.support-card');
const HANDLE = card.dataset.handle;
const SYM = card.dataset.sym || '₦';
const CSRF = document.querySelector('meta[name="csrf-token"]')?.content || '';

const AMOUNTS = [1000, 2000, 5000, 10000];

const state = { freq: 'once', amount: 2000, custom: '' };

const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function fmt(n) { return SYM + Number(n).toLocaleString('en-US'); }

// ---- Amount buttons ----
function renderAmounts() {
  const wrap = $('#amounts');
  wrap.innerHTML = '';
  AMOUNTS.forEach((v) => {
    const b = document.createElement('button');
    b.className = 'amount-btn';
    b.textContent = fmt(v);
    b.addEventListener('click', () => {
      state.amount = v;
      state.custom = '';
      $('#customInput').value = '';
      render();
    });
    wrap.appendChild(b);
  });
}

function currentAmount() {
  return state.custom ? Number(state.custom) : state.amount;
}

function render() {
  $$('.amount-btn').forEach((b, i) => {
    b.classList.toggle('is-selected', !state.custom && state.amount === AMOUNTS[i]);
  });
  $$('.freq-btn').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.freq === state.freq);
  });
  const amt = currentAmount();
  const suffix = state.freq === 'monthly' ? '/mo' : '';
  $('#ctaLabel').textContent = 'Send ' + fmt(amt || 0) + suffix + ' of love';
}

// ---- Card state machine: form / processing / success / error ----
const STATES = ['form', 'processing', 'success', 'error'];
const stateEls = {
  form: $('#supportForm'),
  processing: $('#supportProcessing'),
  success: $('#supportSuccess'),
  error: $('#supportError'),
};
function showState(name) {
  STATES.forEach((s) => { stateEls[s].hidden = s !== name; });
}

async function submit() {
  const amount = currentAmount();
  if (!amount) { $('#customInput')?.focus(); return; }
  showState('processing');
  try {
    const res = await fetch('/' + HANDLE + '/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': CSRF },
      body: JSON.stringify({
        amount,
        recurring: state.freq === 'monthly',
        supporterName: $('#supportName')?.value || '',
        email: $('#supportEmail')?.value || '',
        message: $('#supportMessage')?.value || '',
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.error) { const sub = $('#errorSub'); if (sub) sub.textContent = data.error; }
      throw new Error(data.error || 'charge failed');
    }
    // Managed (Khaime): go to the hosted checkout. Success is shown on return (?thanks=1).
    if (data.status === 'redirect' && data.checkoutUrl) {
      window.location.assign(data.checkoutUrl);
      return;
    }
    throw new Error('unexpected response');
  } catch (e) {
    showState('error');
  }
}

// ---- Events ----
$$('.freq-btn').forEach((b) =>
  b.addEventListener('click', () => { state.freq = b.dataset.freq; render(); })
);

const customInput = $('#customInput');
customInput.addEventListener('focus', () => { state.amount = 0; render(); });
customInput.addEventListener('input', (e) => {
  const cleaned = e.target.value.replace(/[^0-9]/g, '');
  e.target.value = cleaned;
  state.custom = cleaned;
  render();
});

$('#supportCta').addEventListener('click', submit);
$('#retryPay').addEventListener('click', submit);
$('#sendAnother').addEventListener('click', () => showState('form'));

renderAmounts();
render();
// Back from the hosted checkout: show the thank-you (webhook records the payment).
showState(new URLSearchParams(location.search).get('thanks') ? 'success' : 'form');
