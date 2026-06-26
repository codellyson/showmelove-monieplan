// showmelove — public Support Page

const AMOUNTS = [1000, 2000, 5000, 10000];

const NOTES = [
  { name: 'Tunde', initial: 'T', time: '2 hours ago', amount: '₦2,000', quote: 'Your tools saved me so many late nights. Take this and keep building!', color: 'var(--brand)' },
  { name: 'Kemi', initial: 'K', time: '5 hours ago', amount: '₦5,000', quote: 'First time supporting anyone here — you earned it. 🧡', color: 'var(--gold)' },
  { name: 'Anonymous', initial: '?', time: 'yesterday', amount: '₦500', quote: 'Small love, big respect.', color: 'var(--ink)' },
  { name: 'Chidinma', initial: 'C', time: '2 days ago', amount: '₦1,000', quote: 'Keep going, please. We need more people like you.', color: 'var(--gold)' },
];

const state = { freq: 'once', amount: 2000, custom: '' };

const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// ---- Love notes ----
function renderNotes() {
  const grid = $('#notesGrid');
  grid.innerHTML = '';
  NOTES.forEach((n) => {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.innerHTML =
      '<div class="note-card-head">' +
        '<div class="avatar" style="width:36px;height:36px;font-size:15px;background:' + n.color + ';">' + n.initial + '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div class="note-card-name">' + n.name + '</div>' +
          '<div class="note-card-time">' + n.time + '</div>' +
        '</div>' +
        '<div class="note-card-amount">' + n.amount + '</div>' +
      '</div>' +
      '<div class="note-card-quote">' + n.quote + '</div>';
    grid.appendChild(card);
  });
}

// ---- Amount buttons ----
function renderAmounts() {
  const wrap = $('#amounts');
  wrap.innerHTML = '';
  AMOUNTS.forEach((v) => {
    const b = document.createElement('button');
    b.className = 'amount-btn';
    b.textContent = '₦' + v.toLocaleString();
    b.addEventListener('click', () => {
      state.amount = v;
      state.custom = '';
      $('#customInput').value = '';
      render();
    });
    wrap.appendChild(b);
  });
}

function render() {
  // amount selection (only when no custom value)
  $$('.amount-btn').forEach((b, i) => {
    b.classList.toggle('is-selected', !state.custom && state.amount === AMOUNTS[i]);
  });
  // frequency
  $$('.freq-btn').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.freq === state.freq);
  });
  // CTA label
  const amt = state.custom ? Number(state.custom).toLocaleString() : state.amount.toLocaleString();
  const suffix = state.freq === 'monthly' ? '/mo' : '';
  $('#ctaLabel').textContent = 'Send ₦' + amt + suffix + ' of love';
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
  $$('.demo-states button').forEach((b) => b.classList.toggle('is-on', b.dataset.state === name));
}

function currentAmount() {
  return state.custom ? Number(state.custom) : state.amount;
}

function submit() {
  const amt = currentAmount();
  if (!amt) { customInput.focus(); return; }
  const suffix = state.freq === 'monthly' ? ' / month' : '';
  $('#successSub').innerHTML =
    'Ada just got <strong>₦' + amt.toLocaleString() + suffix + '</strong> from you. Thank you for backing the work.';
  showState('processing');
  // Demo: a real build would open Paystack/Stripe checkout and wait on the
  // success webhook. Here we simulate the round-trip.
  setTimeout(() => showState('success'), 1700);
}

$('#supportCta').addEventListener('click', submit);
$('#retryPay').addEventListener('click', submit);
$('#sendAnother').addEventListener('click', () => showState('form'));

// Demo switcher — reach every designed state without a backend
$$('.demo-states button').forEach((b) =>
  b.addEventListener('click', () => showState(b.dataset.state))
);

renderNotes();
renderAmounts();
render();
showState('form');
