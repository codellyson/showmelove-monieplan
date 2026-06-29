// showmelove — shared brand theming.
// Persists the chosen brand color across pages (the design's brandColor palette)
// and renders a floating swatch picker.
(function () {
  const PALETTE = ['#FF5A36', '#F4A93C', '#2A6FDB', '#1F8A5B', '#E84D8A'];
  const KEY = 'sml-brand';

  function current() {
    const saved = localStorage.getItem(KEY);
    if (PALETTE.includes(saved)) return saved;
    // Fall back to the server-set brand (inline --brand) before the palette default.
    const server = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim();
    return server || PALETTE[0];
  }

  function apply(color) {
    document.documentElement.style.setProperty('--brand', color);
  }

  function set(color) {
    apply(color);
    localStorage.setItem(KEY, color);
    render();
    // On owner pages (dashboard/setup/connect/settings), persist to the creator.
    if (document.body.dataset.brandSave === '1') {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
      fetch('/brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf },
        body: JSON.stringify({ color }),
      }).catch(() => {});
    }
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
      b.className = 'theme-swatch' + (color === active ? ' is-active' : '');
      b.style.background = color;
      b.setAttribute('aria-label', 'Use ' + color);
      b.addEventListener('click', () => set(color));
      wrap.appendChild(b);
    });
    dock.appendChild(wrap);
  }

  // Apply before paint to avoid a color flash.
  apply(current());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
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
