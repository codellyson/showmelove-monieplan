// showmelove — login / register, posting to Better Auth's REST endpoints.
const form = document.querySelector('#authForm');
const errEl = document.querySelector('#authError');
const next = document.body.dataset.next || '/dashboard';
const isSignUp = form.dataset.endpoint.includes('sign-up');

errEl.setAttribute('role', 'alert');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

// Better Auth error codes → what we tell people. Anything else gets a generic
// line: its raw messages ("[body.email] Invalid email address; …") are for
// developers, not for this form.
const MESSAGES = {
  INVALID_EMAIL_OR_PASSWORD: "That email and password don't match. Try again, or reset your password.",
  USER_ALREADY_EXISTS: 'There’s already an account with that email. Log in instead?',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'There’s already an account with that email. Log in instead?',
  INVALID_EMAIL: 'Enter a valid email address, like you@email.com.',
  PASSWORD_TOO_SHORT: `Use at least ${MIN_PASSWORD} characters for your password.`,
  PASSWORD_TOO_LONG: `Use at most ${MAX_PASSWORD} characters for your password.`,
  EMAIL_NOT_VERIFIED: 'Confirm your email first — check your inbox for the link we sent.',
  FAILED_TO_CREATE_USER: 'We couldn’t create your account. Please try again.',
};

function showError(message, field) {
  errEl.textContent = message;
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  if (field) {
    field.setAttribute('aria-invalid', 'true');
    field.focus();
  }
}

function serverMessage(res, data) {
  if (res.status === 429) return 'Too many attempts. Wait a minute and try again.';
  return MESSAGES[data.code] || (isSignUp
    ? 'We couldn’t create your account. Check your details and try again.'
    : 'We couldn’t log you in. Check your details and try again.');
}

/** Returns [message, field] for the first problem, or null when the form is fine. */
function validate() {
  const { name, email, password } = form.elements;
  if (isSignUp && !name.value.trim()) return ['Add your name.', name];
  if (!email.value.trim()) return ['Enter your email address.', email];
  if (!EMAIL_RE.test(email.value.trim())) return ['Enter a valid email address, like you@email.com.', email];
  if (!password.value) return [isSignUp ? 'Choose a password.' : 'Enter your password.', password];
  if (isSignUp && password.value.length < MIN_PASSWORD) {
    return [`Use at least ${MIN_PASSWORD} characters for your password.`, password];
  }
  if (isSignUp && password.value.length > MAX_PASSWORD) {
    return [`Use at most ${MAX_PASSWORD} characters for your password.`, password];
  }
  return null;
}

// Clear a field's error as soon as it's edited.
form.addEventListener('input', (e) => {
  if (e.target.getAttribute('aria-invalid')) {
    e.target.removeAttribute('aria-invalid');
    errEl.textContent = '';
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const problem = validate();
  if (problem) return showError(...problem);
  showError('');

  const btn = form.querySelector('button[type="submit"]');
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Please wait…';

  const payload = Object.fromEntries(new FormData(form).entries());
  payload.email = payload.email.trim();
  if (payload.name !== undefined) payload.name = payload.name.trim();

  try {
    const res = await fetch(form.dataset.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showError(serverMessage(res, data));
      btn.disabled = false;
      btn.textContent = label;
      return;
    }
    window.location.assign(next);
  } catch (err) {
    showError('Network error. Please try again.');
    btn.disabled = false;
    btn.textContent = label;
  }
});
