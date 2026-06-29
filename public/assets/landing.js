// showmelove — Landing page social proof
const PROOF = [
  { quote: '"Your tools saved me so many late nights. Keep building!"', name: 'Tunde', amount: '₦2,000', color: 'var(--brand)' },
  { quote: '"First time supporting anyone here — you earned it. 🧡"', name: 'Kemi', amount: '₦5,000', color: 'var(--gold)' },
  { quote: '"Keep going, please. We need more people like you."', name: 'Chidinma', amount: '₦1,000', color: 'var(--ink)' },
];

const grid = document.querySelector('#proofGrid');
PROOF.forEach((p) => {
  const card = document.createElement('div');
  card.className = 'proof-card';
  card.innerHTML =
    '<div class="proof-quote">' + p.quote + '</div>' +
    '<div class="proof-foot">' +
      '<div class="avatar" style="width:32px;height:32px;font-size:13px;background:' + p.color + ';">' + p.name[0] + '</div>' +
      '<span class="proof-name">' + p.name + '</span>' +
      '<span class="proof-amt">' + p.amount + '</span>' +
    '</div>';
  grid.appendChild(card);
});
