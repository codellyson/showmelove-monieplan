// showmelove — forgot/reset password, posting to Better Auth.
const forgotForm = document.querySelector('#forgotForm');
const resetForm = document.querySelector('#resetForm');
const errEl = document.querySelector('#authError');

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return [res, await res.json().catch(() => ({}))];
}

function busy(form, on, label) {
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = on;
  if (on) { btn.dataset.label = btn.textContent; btn.textContent = label; }
  else { btn.textContent = btn.dataset.label || btn.textContent; }
}

if (forgotForm) {
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.textContent = '';
    busy(forgotForm, true, 'Sending…');
    const [res, data] = await post('/api/auth/request-password-reset', {
      email: forgotForm.email.value.trim(),
      redirectTo: '/reset',
    });
    busy(forgotForm, false);
    if (!res.ok) {
      errEl.textContent = data.message || 'Could not send a reset link.';
      return;
    }
    forgotForm.hidden = true;
    document.querySelector('#authOk').hidden = false;
  });
}

if (resetForm) {
  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.textContent = '';
    busy(resetForm, true, 'Saving…');
    const [res, data] = await post('/api/auth/reset-password', {
      newPassword: resetForm.password.value,
      token: resetForm.dataset.token,
    });
    if (!res.ok) {
      busy(resetForm, false);
      errEl.textContent = data.message || 'Could not reset password. The link may have expired.';
      return;
    }
    window.location.assign('/login?reset=1');
  });
}
