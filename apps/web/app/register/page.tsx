'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Message } from '../../components/message';
import { useAuth } from '../../lib/auth';
import { getErrorMessage } from '../../lib/errors';
import { validateEmail, validatePassword } from '../../lib/validators';

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (fullName.trim().length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }
    if (!validateEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    setSubmitting(true);
    try {
      await register(fullName, email, password);
      const next = new URLSearchParams(window.location.search).get('next');
      router.push(next || '/dashboard');
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to create account'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card narrow">
      <h1>Create an account</h1>
      <p>Register, then set up your first business profile from settings.</p>
      <form onSubmit={onSubmit}>
        <label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required minLength={2} /></label>
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required minLength={8} /></label>
        <p className="hint">Use at least 8 characters with uppercase, lowercase, and a number.</p>
        <Message error={error} />
        <button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create account'}</button>
      </form>
      <p className="muted">Already registered? <Link href="/login">Log in</Link>.</p>
    </section>
  );
}
