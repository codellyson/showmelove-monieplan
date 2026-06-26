// showmelove — Dashboard

const NAV_ICONS = {
  Home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  Supporters: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>',
  Payouts: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  Settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 7.6 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3 15.6a1.65 1.65 0 0 0-1.51-1H1a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 3 8.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8.4 3h.09A1.65 1.65 0 0 0 10 1.51V1a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1.51 1.51"/>',
};
const NAV = ['Home', 'Supporters', 'Payouts', 'Settings'];

const SUPPORTERS = [
  { name: 'Tunde', initial: 'T', quote: '"Your tools saved me so many late nights."', amount: '₦2,000', time: '2h ago', color: 'var(--brand)' },
  { name: 'Kemi', initial: 'K', quote: '"First time supporting — you earned it. 🧡"', amount: '₦5,000', time: '5h ago', color: 'var(--gold)' },
  { name: 'Anonymous', initial: '?', quote: '"Small love, big respect."', amount: '₦500', time: 'yesterday', color: 'var(--ink)' },
  { name: 'Chidinma', initial: 'C', quote: '"Keep going, please. We need more people like you."', amount: '₦1,000', time: '2d ago', color: 'var(--gold)' },
];

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// Account-state variants (PRD §6: populated / empty / bring-your-own)
const VARIANTS = {
  managed: {
    total: '₦45,000', totalDelta: '↑ ₦12k vs last month',
    supporters: '23', supportersDelta: '↑ 4 this week',
    goalFig: '<b>₦45k</b> <span class="goal-of">/ ₦100k</span>',
    goalPct: 45, goalNote: '₦55,000 to reach your goal',
    welcomeSub: 'You got <span class="accent">4 new love notes</span> this week.',
    notes: true, nudge: true, badge: false,
  },
  empty: {
    total: '₦0', totalDelta: 'No support yet',
    supporters: '0', supportersDelta: 'Share your link to begin',
    goalFig: '<b>₦0</b> <span class="goal-of">/ ₦100k</span>',
    goalPct: 0, goalNote: '₦100,000 to reach your goal',
    welcomeSub: 'Your page is live — share it to get your first love note.',
    notes: false, nudge: false, badge: false,
  },
  byo: {
    total: '₦45,000', totalDelta: '↑ ₦12k vs last month',
    supporters: '23', supportersDelta: '↑ 4 this week',
    goalFig: '<b>₦45k</b> <span class="goal-of">/ ₦100k</span>',
    goalPct: 45, goalNote: '₦55,000 to reach your goal',
    welcomeSub: 'You got <span class="accent">4 new love notes</span> this week.',
    notes: true, nudge: false, badge: true,
  },
};

let active = 'Home';
let variant = 'managed';
let nudgeDismissed = false;

function renderNav() {
  const navEl = $('#sideNav');
  navEl.innerHTML = '';
  NAV.forEach((label) => {
    const isActive = label === active;
    const item = document.createElement('div');
    item.className = 'nav-item' + (isActive ? ' is-active' : '');
    item.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' +
      (isActive ? '#fff' : '#8A7F6B') +
      '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      NAV_ICONS[label] + '</svg><span>' + label + '</span>';
    item.addEventListener('click', () => { active = label; renderNav(); });
    navEl.appendChild(item);
  });
}

function renderNotes() {
  const list = $('#noteList');
  list.innerHTML = '';

  if (!VARIANTS[variant].notes) {
    list.innerHTML =
      '<div class="notes-empty">' +
        '<div class="notes-empty-icon">' +
          '<svg width="26" height="26" viewBox="0 0 24 24" fill="var(--brand)"><path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5.5 6 5.5c2 0 3.2 1.3 4 2.5.8-1.2 2-2.5 4-2.5 3.5 0 5 3.5 3.5 6.5C19 16.5 12 21 12 21Z"/></svg>' +
        '</div>' +
        '<div class="notes-empty-title">No love notes yet</div>' +
        '<div class="notes-empty-sub">Share your link to get your first one.</div>' +
      '</div>';
    return;
  }

  SUPPORTERS.forEach((sp) => {
    const row = document.createElement('div');
    row.className = 'note';
    row.innerHTML =
      '<div class="avatar" style="width:40px;height:40px;font-size:15px;background:' + sp.color + ';">' + sp.initial + '</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div class="note-name">' + sp.name + '</div>' +
        '<div class="note-quote">' + sp.quote + '</div>' +
      '</div>' +
      '<div class="note-right">' +
        '<div class="note-amount">' + sp.amount + '</div>' +
        '<div class="note-time">' + sp.time + '</div>' +
      '</div>';
    list.appendChild(row);
  });
}

function renderVariant() {
  const v = VARIANTS[variant];
  $('#mTotal').textContent = v.total;
  $('#mTotalDelta').textContent = v.totalDelta;
  $('#mSupporters').textContent = v.supporters;
  $('#mSupportersDelta').textContent = v.supportersDelta;
  $('#mGoalFig').innerHTML = v.goalFig;
  $('#mGoalBar').style.width = v.goalPct + '%';
  $('#mGoalNote').textContent = v.goalNote;
  $('#welcomeSub').innerHTML = v.welcomeSub;
  $('#headBadge').hidden = !v.badge;
  $('#nudge').classList.toggle('is-hidden', !v.nudge || nudgeDismissed);
  $$('.dash-variants button').forEach((b) => b.classList.toggle('is-on', b.dataset.variant === variant));
  renderNotes();
}

// Demo variant switcher
$$('.dash-variants button').forEach((b) =>
  b.addEventListener('click', () => {
    variant = b.dataset.variant;
    nudgeDismissed = false;
    renderVariant();
  })
);

// Copy link
$('#copyBtn').addEventListener('click', () => {
  const label = $('#copyLabel');
  if (navigator.clipboard) {
    navigator.clipboard.writeText('https://showmelove.com/adabuilds').catch(() => {});
  }
  const prev = label.textContent;
  label.textContent = 'Copied!';
  setTimeout(() => { label.textContent = prev; }, 1400);
});

// Dismiss nudge
$('#nudgeClose').addEventListener('click', () => {
  nudgeDismissed = true;
  $('#nudge').classList.add('is-hidden');
});

renderNav();
renderVariant();
