// showmelove — public Support Page (wired to AdonisJS backend)

const card = document.querySelector('.support-card');
const HANDLE = card.dataset.handle;
const SYM = card.dataset.sym || '₦';
const CURRENCY = (card.dataset.currency || 'NGN').toUpperCase();
const CSRF = document.querySelector('meta[name="csrf-token"]')?.content || '';

// Suggested amounts scale to the currency: large units for African currencies,
// small units for USD/GBP/EUR and the like.
const LARGE_UNIT = ['NGN', 'GHS', 'KES', 'ZAR', 'TZS', 'XAF', 'XOF'];
const AMOUNTS = LARGE_UNIT.includes(CURRENCY) ? [1000, 2000, 5000, 10000] : [5, 10, 25, 50];

const state = { freq: 'once', amount: AMOUNTS[1], custom: '', pay: CURRENCY };

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
  $$('.freq-btn[data-freq]').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.freq === state.freq);
  });
  $$('.pay-btn').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.pay === state.pay);
  });
  const amt = currentAmount();
  const suffix = state.freq === 'monthly' ? '/mo' : '';
  const payNote = state.pay !== CURRENCY ? ' (paid in ' + state.pay + ')' : '';
  $('#ctaLabel').textContent = 'Send ' + fmt(amt || 0) + suffix + ' of love' + payNote;
}

// ---- Card state machine: form / processing / payment / success / error ----
const STATES = ['form', 'processing', 'payment', 'success', 'error'];
const stateEls = {
  form: $('#supportForm'),
  processing: $('#supportProcessing'),
  payment: $('#supportPayment'),
  success: $('#supportSuccess'),
  error: $('#supportError'),
};
function showState(name) {
  STATES.forEach((s) => { if (stateEls[s]) stateEls[s].hidden = s !== name; });
}

// Stripe Elements (USD and other Stripe-gateway charges).
let stripe = null;
let elements = null;
let returnUrl = '';
async function startStripe(data) {
  if (!window.Stripe) throw new Error('Stripe failed to load');
  stripe = window.Stripe(data.publishableKey, data.stripeAccountId ? { stripeAccount: data.stripeAccountId } : undefined);
  elements = stripe.elements({ clientSecret: data.clientSecret });
  elements.create('payment').mount('#payment-element');
  returnUrl = data.returnUrl;
  showState('payment');
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
        payCurrency: state.pay,
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
    // Paystack: hosted checkout — success shown on return (?thanks=1).
    if (data.status === 'redirect' && data.checkoutUrl) {
      window.location.assign(data.checkoutUrl);
      return;
    }
    // Stripe: confirm the card here; success shown on return (?thanks=1).
    if (data.status === 'stripe') {
      await startStripe(data);
      return;
    }
    throw new Error('unexpected response');
  } catch (e) {
    showState('error');
  }
}

// ---- Events ----
$$('.freq-btn[data-freq]').forEach((b) =>
  b.addEventListener('click', () => { state.freq = b.dataset.freq; render(); })
);
$$('.pay-btn').forEach((b) =>
  b.addEventListener('click', () => { state.pay = b.dataset.pay; render(); })
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

// Stripe pay: confirm the PaymentIntent. On success Stripe redirects to returnUrl
// (?thanks=1); the webhook records the payment. Only immediate errors land here.
$('#payNow')?.addEventListener('click', async () => {
  if (!stripe || !elements) return;
  const btn = $('#payNow');
  btn.disabled = true; $('#payLabel').textContent = 'Processing…';
  $('#payError').hidden = true;
  const { error } = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl } });
  if (error) {
    const pe = $('#payError');
    pe.textContent = error.message || 'Payment failed. Check your details and try again.';
    pe.hidden = false;
    btn.disabled = false; $('#payLabel').textContent = 'Pay now';
  }
});
$('#payCancel')?.addEventListener('click', () => showState('form'));

renderAmounts();
render();
// Back from the hosted checkout: show the thank-you (webhook records the payment).
showState(new URLSearchParams(location.search).get('thanks') ? 'success' : 'form');
