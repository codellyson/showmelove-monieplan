// showmelove — Connect a processor flow

const $ = (s) => document.querySelector(s);

const PROC_LABEL = { paystack: 'Paystack', stripe: 'Stripe' };

const state = { proc: null };

const els = {
  select: $('#stageSelect'),
  connecting: $('#stageConnecting'),
  connected: $('#stageConnected'),
  panelPaystack: $('#panelPaystack'),
  panelStripe: $('#panelStripe'),
  emptyHint: $('#emptyHint'),
};

function selectProc(proc) {
  state.proc = proc;
  $('#procPaystack').classList.toggle('is-selected', proc === 'paystack');
  $('#procStripe').classList.toggle('is-selected', proc === 'stripe');
  els.panelPaystack.hidden = proc !== 'paystack';
  els.panelStripe.hidden = proc !== 'stripe';
  els.emptyHint.hidden = proc !== null;
}

function showStage(name) {
  els.select.hidden = name !== 'select';
  els.connecting.hidden = name !== 'connecting';
  els.connected.hidden = name !== 'connected';
}

function connect(proc) {
  const label = PROC_LABEL[proc];
  $('#connectingTitle').textContent = 'Connecting to ' + label + '…';
  showStage('connecting');
  // Demo: a real build would redirect to OAuth (Stripe) or verify keys (Paystack)
  // via the backend, then return on the webhook/callback.
  setTimeout(() => {
    $('#connectedTitle').textContent = label + ' connected';
    showStage('connected');
  }, 1600);
}

// ---- Events ----
$('#procPaystack').addEventListener('click', () => selectProc('paystack'));
$('#procStripe').addEventListener('click', () => selectProc('stripe'));

$('#connectPaystack').addEventListener('click', () => {
  // Minimal validation — both keys present
  const pub = $('#psPublic').value.trim();
  const sec = $('#psSecret').value.trim();
  if (!pub || !sec) {
    (pub ? $('#psSecret') : $('#psPublic')).focus();
    return;
  }
  connect('paystack');
});

$('#connectStripe').addEventListener('click', () => connect('stripe'));

$('#switchBack').addEventListener('click', () => {
  selectProc(null);
  $('#psPublic').value = '';
  $('#psSecret').value = '';
  showStage('select');
});
