// showmelove — Connect a processor flow (wired to AdonisJS backend)

const $ = (s) => document.querySelector(s);
const CSRF = document.querySelector('meta[name="csrf-token"]')?.content || '';

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

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': CSRF },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error('request failed');
  return res.json();
}

async function connect(proc) {
  const label = PROC_LABEL[proc];
  $('#connectingTitle').textContent = 'Connecting to ' + label + '…';
  showStage('connecting');
  try {
    // Persist the switch to bring-your-own. A real build would redirect to
    // Stripe OAuth / verify Paystack keys before reaching this point.
    await post('/connect', { processor: proc });
    setTimeout(() => {
      $('#connectedTitle').textContent = label + ' connected';
      showStage('connected');
    }, 1200);
  } catch (e) {
    showStage('select');
    alert('Could not connect. Please try again.');
  }
}

// ---- Events ----
$('#procPaystack').addEventListener('click', () => selectProc('paystack'));
$('#procStripe').addEventListener('click', () => selectProc('stripe'));

$('#connectPaystack').addEventListener('click', () => {
  const pub = $('#psPublic').value.trim();
  const sec = $('#psSecret').value.trim();
  if (!pub || !sec) {
    (pub ? $('#psSecret') : $('#psPublic')).focus();
    return;
  }
  connect('paystack');
});

$('#connectStripe').addEventListener('click', () => connect('stripe'));

$('#switchBack').addEventListener('click', async () => {
  try { await post('/connect/reset'); } catch (e) { /* non-fatal */ }
  $('#psPublic').value = '';
  $('#psSecret').value = '';
  selectProc('paystack');
  showStage('select');
});

// Preselect Paystack (first option, Nigeria-first) so the panel is ready
// and the card isn't left with empty space.
selectProc('paystack');
