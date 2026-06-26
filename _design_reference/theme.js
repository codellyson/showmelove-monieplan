// showmelove — shared brand theming.
// Persists the chosen brand color across pages (the design's brandColor palette)
// and renders a floating swatch picker.
(function () {
  const PALETTE = ['#FF5A36', '#F4A93C', '#2A6FDB', '#1F8A5B', '#E84D8A'];
  const KEY = 'sml-brand';

  function current() {
    const saved = localStorage.getItem(KEY);
    return PALETTE.includes(saved) ? saved : PALETTE[0];
  }

  function apply(color) {
    document.documentElement.style.setProperty('--brand', color);
  }

  function set(color) {
    apply(color);
    localStorage.setItem(KEY, color);
    render();
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
