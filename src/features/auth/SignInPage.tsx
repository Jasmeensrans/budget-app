import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { signInWithGoogle } from '../../data/auth';

const MESSAGES: Record<string, string> = {
  'auth/popup-closed-by-user': 'The sign-in window was closed before finishing. Try again.',
  'auth/cancelled-popup-request': 'The sign-in window was closed before finishing. Try again.',
  'auth/unauthorized-domain': 'This web address isn’t allowed to sign in yet. Add it under Authentication → Settings → Authorized domains in Firebase.',
  'auth/network-request-failed': 'Couldn’t reach Google. Check your connection and try again.',
};

export function SignInPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      setError(MESSAGES[code] ?? 'Sign-in didn’t work. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="signin">
      <div className="card signin__card">
        <span className="brand-mark signin__mark">
          <Icon name="leaf" size={26} strokeWidth={2} />
        </span>
        <h1 className="signin__title">My Budget</h1>
        <p className="muted signin__body">Sign in to see your budget. Your data syncs between your phone and computer.</p>
        <Button variant="primary" size="lg" onClick={handleSignIn} loading={busy} className="signin__button">
          Continue with Google
        </Button>
        {error && (
          <p className="field__error signin__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

export function LoadingScreen({ label = 'Loading your budget…' }: { label?: string }) {
  return (
    <main className="signin" aria-busy="true">
      <div className="signin__loading">
        <span className="btn__spinner signin__spinner" aria-hidden="true" />
        <span className="muted">{label}</span>
      </div>
    </main>
  );
}
