// showmelove — brand color picker for a creator's own pages.
//
// The server renders each page's brand (`--brand`) from the creator who owns
// it, and that always wins. The floating swatch picker only appears on the
// signed-in creator's own pages (body data-brand-save="1"); a pick there is
// saved to their creator via POST /brand, so every page they and their
// visitors open shows it. Visitors never see the picker and can't recolor a
// page for themselves.
(function () {
  const PALETTE = ['#FF5A36', '#F4A93C', '#2A6FDB', '#1F8A5B', '#E84D8A'];

  // Older versions kept a per-browser pick here, which overrode creators'
  // colors on their public pages. Clear it so it can't come back.
  try { localStorage.removeItem('sml-brand'); } catch {}

  function current() {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim();
    return PALETTE.includes(value.toUpperCase()) ? value.toUpperCase() : PALETTE[0];
  }

  function set(color) {
    document.documentElement.style.setProperty('--brand', color);
    render();
    const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
    fetch('/brand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf },
      body: JSON.stringify({ color }),
    }).catch(() => {});
  }

  let dock;
  function render() {
    const active = current();
    if (!dock) {
      dock = document.createElement('div');
      dock.className = 'theme-dock';
      document.body.appendChild(dock);
    }
    dock.innerHTML = '<span class="theme-dock-label">Brand</span>';
    const wrap = document.createElement('div');
    wrap.className = 'theme-swatches';
    PALETTE.forEach((color) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'theme-swatch' + (color === active ? ' is-active' : '');
      b.style.background = color;
      b.setAttribute('aria-label', 'Use ' + color);
      b.setAttribute('aria-pressed', String(color === active));
      b.addEventListener('click', () => set(color));
      wrap.appendChild(b);
    });
    dock.appendChild(wrap);
  }

  function init() {
    if (document.body.dataset.brandSave === '1') render();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// Account menu dropdown (works on any page that includes the menu partial).
(function () {
  function close() {
    document.querySelectorAll('.acct-menu').forEach((m) => (m.hidden = true));
  }
  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-menu-toggle]');
    if (toggle) {
      const menu = toggle.parentElement.querySelector('.acct-menu');
      const wasOpen = menu && !menu.hidden;
      close();
      if (menu) menu.hidden = wasOpen;
      return;
    }
    if (!e.target.closest('.acct-menu')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
})();
