'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { Business } from '@billora/shared';
import { Message } from '../../components/message';
import { ProtectedPage } from '../../components/protected-page';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { validateEmail } from '../../lib/validators';

const emptyBusiness = { name: '', email: '', phone: '', address: '', city: '', country: '', taxNumber: '' };

export default function Settings() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [form, setForm] = useState(emptyBusiness);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const activeBusiness = businesses[0];

  async function load() {
    const data = await api.businesses();
    setBusinesses(data);
    if (data[0]) setForm({
      name: data[0].name ?? '',
      email: data[0].email ?? '',
      phone: data[0].phone ?? '',
      address: data[0].address ?? '',
      city: data[0].city ?? '',
      country: data[0].country ?? '',
      taxNumber: data[0].taxNumber ?? '',
    });
  }

  useEffect(() => {
    load().catch((err) => setError(getErrorMessage(err, 'Unable to load business profile'))).finally(() => setLoading(false));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (form.name.trim().length < 2) {
      setError('Business name must be at least 2 characters.');
      return;
    }
    if (!validateEmail(form.email)) {
      setError('Enter a valid business email address.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, value]) => value.trim() !== ''));
      if (activeBusiness) await api.updateBusiness(activeBusiness.id, payload);
      else await api.createBusiness(payload as typeof form & { name: string });
      setSuccess('Business profile saved.');
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to save business profile'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ProtectedPage>
      <section className="card">
        <h1>Business settings</h1>
        <p>Create or update the business profile used for customers and invoices.</p>
        {loading && <p className="muted">Loading business profile...</p>}
        <form className="grid two" onSubmit={onSubmit}>
          <label>Business name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
          <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
          <label>Tax number<input value={form.taxNumber} onChange={(event) => setForm({ ...form, taxNumber: event.target.value })} /></label>
          <label>City<input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label>
          <label>Country<input value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></label>
          <label className="full">Address<input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
          <div className="full"><Message error={error} success={success} /></div>
          <button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save business'}</button>
        </form>
      </section>
    </ProtectedPage>
  );
}
