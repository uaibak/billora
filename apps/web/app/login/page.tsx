'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Message } from '../../components/message';
import { useAuth } from '../../lib/auth';
import { getErrorMessage } from '../../lib/errors';
import { validateEmail } from '../../lib/validators';

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!validateEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      await login(email, password);
      const next = new URLSearchParams(window.location.search).get('next');
      router.push(next || '/dashboard');
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to log in'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card narrow">
      <h1>Log in</h1>
      <p>Access your invoicing workspace.</p>
      <form onSubmit={onSubmit}>
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
        <Message error={error} />
        <button type="submit" disabled={submitting}>{submitting ? 'Logging in...' : 'Log in'}</button>
      </form>
      <p className="muted">No account yet? <Link href="/register">Create one</Link>.</p>
    </section>
  );
}
