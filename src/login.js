import { getSupabase, getSession, signInWithGoogle, signInWithEmail, signUpWithEmail } from './auth.js';
import { logUserActivity } from './telemetry.js';

async function init() {
  const sb = getSupabase();
  const feedback = document.getElementById('feedback');
  const setFeedback = (msg, kind = 'info') => {
    if (!feedback) return;
    feedback.textContent = msg || '';
    feedback.className = kind === 'error' ? 'error' : (kind === 'success' ? 'success' : 'subtle');
  };

  // If already signed in, jump to app
  const { data } = await getSession();
  if (data?.session) {
    location.href = '/app.html';
    return;
  }

  document.getElementById('btn-google')?.addEventListener('click', async () => {
    try {
      if (!sb) throw new Error('Auth not configured');
      setFeedback('Redirecting to Google...', 'info');
      await signInWithGoogle();
    } catch (e) {
      setFeedback(e?.message || 'Google sign-in failed', 'error');
    }
  });

  document.getElementById('btn-email-signin')?.addEventListener('click', async () => {
    const email = (document.getElementById('email')?.value || '').trim();
    const password = (document.getElementById('password')?.value || '').trim();
    if (!email || !password) return setFeedback('Enter email and password', 'error');
    const { data, error } = await signInWithEmail({ email, password });
    if (error) return setFeedback(error.message || 'Invalid credentials', 'error');
    const userId = data?.user?.id;
    if (userId) await logUserActivity(userId, 'email_signin');
    setFeedback('Signed in. Redirecting...', 'success');
    location.href = '/app.html';
  });

  document.getElementById('btn-email-signup')?.addEventListener('click', async () => {
    const email = (document.getElementById('email')?.value || '').trim();
    const password = (document.getElementById('password')?.value || '').trim();
    if (!email || !password) return setFeedback('Enter email and password', 'error');
    const { data, error } = await signUpWithEmail({ email, password });
    if (error) return setFeedback(error.message || 'Sign up failed', 'error');
    const userId = data?.user?.id;
    if (userId) await logUserActivity(userId, 'email_signup');
    setFeedback('Account created. Check your email to confirm, then sign in.', 'success');
  });
}

init();


