// showmelove — login / register, posting to Better Auth's REST endpoints.
const form = document.querySelector('#authForm');
const errEl = document.querySelector('#authError');
const next = document.body.dataset.next || '/dashboard';

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errEl.textContent = '';
  const btn = form.querySelector('button[type="submit"]');
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Please wait…';

  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    const res = await fetch(form.dataset.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      errEl.textContent = data.message || data.error?.message || 'Something went wrong. Check your details.';
      btn.disabled = false;
      btn.textContent = label;
      return;
    }
    window.location.assign(next);
  } catch (err) {
    errEl.textContent = 'Network error. Please try again.';
    btn.disabled = false;
    btn.textContent = label;
  }
});
