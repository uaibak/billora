'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { Message } from '../../../components/message';
import { ProtectedPage } from '../../../components/protected-page';
import { useToast } from '../../../components/toast-provider';
import { api } from '../../../lib/api';
import { getErrorMessage } from '../../../lib/errors';

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<section className="card narrow"><p>Loading invite...</p></section>}>
      <AcceptInviteContent />
    </Suspense>
  );
}

function AcceptInviteContent() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setToken(params.get('token') ?? '');
  }, [params]);

  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token.trim()) {
      setError('Invite token is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.acceptOrganizationInvite(token.trim());
      toast.success('Invite accepted.');
      window.setTimeout(() => router.replace('/settings'), 900);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to accept invite'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ProtectedPage>
      <section className="card narrow">
        <p className="eyebrow">Team invite</p>
        <h1>Accept invite</h1>
        <p>Paste your invite token to join the organization. You must be logged in with the same email address the invite was sent to.</p>
        <form onSubmit={accept}>
          <label>Invite token<input value={token} onChange={(event) => setToken(event.target.value)} required /></label>
          <Message error={error} />
          <div className="actions">
            <button type="submit" disabled={submitting}>{submitting ? 'Accepting...' : 'Accept invite'}</button>
            <Link className="button secondary" href="/settings">Back to settings</Link>
          </div>
        </form>
      </section>
    </ProtectedPage>
  );
}
