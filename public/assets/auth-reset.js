// showmelove — forgot/reset password, posting to Better Auth.
const forgotForm = document.querySelector('#forgotForm');
const resetForm = document.querySelector('#resetForm');
const errEl = document.querySelector('#authError');
if (errEl) errEl.setAttribute('role', 'alert');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

// Better Auth's raw messages are for developers; say something human instead.
function showError(form, message, field) {
  errEl.textContent = message;
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  if (field) {
    field.setAttribute('aria-invalid', 'true');
    field.focus();
  }
}

for (const f of [forgotForm, resetForm]) {
  f?.addEventListener('input', (e) => {
    if (e.target.getAttribute('aria-invalid')) {
      e.target.removeAttribute('aria-invalid');
      errEl.textContent = '';
    }
  });
}

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
    const email = forgotForm.email;
    if (!email.value.trim()) return showError(forgotForm, 'Enter your email address.', email);
    if (!EMAIL_RE.test(email.value.trim())) {
      return showError(forgotForm, 'Enter a valid email address, like you@email.com.', email);
    }
    showError(forgotForm, '');
    busy(forgotForm, true, 'Sending…');
    const [res, data] = await post('/api/auth/request-password-reset', {
      email: forgotForm.email.value.trim(),
      redirectTo: '/reset',
    });
    busy(forgotForm, false);
    if (!res.ok) {
      showError(forgotForm, res.status === 429
        ? 'Too many attempts. Wait a minute and try again.'
        : 'We couldn’t send a reset link. Please try again.');
      return;
    }
    forgotForm.hidden = true;
    document.querySelector('#authOk').hidden = false;
  });
}

if (resetForm) {
  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = resetForm.password;
    if (!password.value) return showError(resetForm, 'Choose a new password.', password);
    if (password.value.length < MIN_PASSWORD) {
      return showError(resetForm, `Use at least ${MIN_PASSWORD} characters for your password.`, password);
    }
    showError(resetForm, '');
    busy(resetForm, true, 'Saving…');
    const [res, data] = await post('/api/auth/reset-password', {
      newPassword: resetForm.password.value,
      token: resetForm.dataset.token,
    });
    if (!res.ok) {
      busy(resetForm, false);
      showError(resetForm, data.code === 'INVALID_TOKEN'
        ? 'This reset link is invalid or has expired. Request a new one.'
        : 'We couldn’t reset your password. The link may have expired — request a new one.');
      return;
    }
    window.location.assign('/login?reset=1');
  });
}
