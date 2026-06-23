'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { Business, Customer } from '@billora/shared';
import { EmptyState } from '../../components/empty-state';
import { Message } from '../../components/message';
import { ProtectedPage } from '../../components/protected-page';
import { api } from '../../lib/api';
import { confirmAction, getErrorMessage } from '../../lib/errors';
import { validateEmail } from '../../lib/validators';

const emptyCustomer = { name: '', email: '', phone: '', address: '', city: '', country: '' };

export default function Customers() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState(emptyCustomer);
  const [editingId, setEditingId] = useState('');
  const [editForm, setEditForm] = useState(emptyCustomer);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  async function load() {
    const [businessData, customerData] = await Promise.all([api.businesses(), api.customers()]);
    setBusinesses(businessData);
    if (!businessId && businessData[0]) setBusinessId(businessData[0].id);
    setCustomers(customerData);
  }

  useEffect(() => {
    load().catch((err) => setError(getErrorMessage(err, 'Unable to load customers'))).finally(() => setLoading(false));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!businessId) {
      setError('Create a business profile in settings before adding customers.');
      return;
    }
    if (form.name.trim().length < 2) {
      setError('Customer name must be at least 2 characters.');
      return;
    }
    if (!validateEmail(form.email)) {
      setError('Enter a valid customer email address.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, value]) => value.trim() !== ''));
      await api.createCustomer({ businessId, ...(payload as typeof form), name: form.name });
      setForm(emptyCustomer);
      setSuccess('Customer created.');
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to create customer'));
    } finally {
      setSubmitting(false);
    }
  }

  async function removeCustomer(id: string) {
    if (!confirmAction('Delete this customer? This cannot be undone.')) return;
    setError('');
    setSuccess('');
    setBusyId(id);
    try {
      await api.deleteCustomer(id);
      setSuccess('Customer deleted.');
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to delete customer'));
    } finally {
      setBusyId('');
    }
  }

  function startEdit(customer: Customer) {
    setEditingId(customer.id);
    setEditForm({
      name: customer.name ?? '',
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      address: customer.address ?? '',
      city: customer.city ?? '',
      country: customer.country ?? '',
    });
  }

  async function saveEdit(id: string) {
    setError('');
    setSuccess('');
    if (editForm.name.trim().length < 2) {
      setError('Customer name must be at least 2 characters.');
      return;
    }
    if (!validateEmail(editForm.email)) {
      setError('Enter a valid customer email address.');
      return;
    }
    setBusyId(id);
    try {
      const payload = Object.fromEntries(Object.entries(editForm).filter(([, value]) => value.trim() !== ''));
      await api.updateCustomer(id, payload);
      setEditingId('');
      setSuccess('Customer updated.');
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to update customer'));
    } finally {
      setBusyId('');
    }
  }

  const visibleCustomers = businessId ? customers.filter((customer) => customer.businessId === businessId) : customers;

  return (
    <ProtectedPage>
      <section className="stack">
        <div className="card">
          <h1>Customers</h1>
          <p>Add the people and companies you invoice.</p>
          <form className="grid two" onSubmit={onSubmit}>
            <label>Business
              <select value={businessId} onChange={(event) => setBusinessId(event.target.value)} required>
                <option value="">Select business</option>
                {businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
              </select>
            </label>
            <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
            <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
            <label>City<input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label>
            <label>Country<input value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></label>
            <label className="full">Address<input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
            <div className="full"><Message error={error} success={success} /></div>
            <button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Add customer'}</button>
          </form>
        </div>
        <div className="card">
          <h2>Customer list</h2>
          <div className="table">
            {loading && <p className="muted">Loading customers...</p>}
            {visibleCustomers.map((customer) => (
              <div className="table-row" key={customer.id}>
                {editingId === customer.id ? (
                  <>
                    <span className="inline-edit">
                      <input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} required />
                      <input type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} placeholder="Email" />
                      <input value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} placeholder="Phone" />
                      <input value={editForm.city} onChange={(event) => setEditForm({ ...editForm, city: event.target.value })} placeholder="City" />
                    </span>
                    <span>{customer.business?.name || 'Business'}</span>
                    <span className="actions small">
                      <button type="button" onClick={() => void saveEdit(customer.id)} disabled={busyId === customer.id}>Save</button>
                      <button className="secondary" type="button" onClick={() => setEditingId('')}>Cancel</button>
                    </span>
                  </>
                ) : (
                  <>
                    <span><strong>{customer.name}</strong><small>{customer.email || 'No email'}</small></span>
                    <span>{customer.city || customer.country || customer.business?.name || 'No location'}</span>
                    <span className="actions small">
                      <button className="secondary" type="button" onClick={() => startEdit(customer)} disabled={Boolean(busyId)}>Edit</button>
                      <button className="danger secondary" type="button" onClick={() => void removeCustomer(customer.id)} disabled={busyId === customer.id}>{busyId === customer.id ? 'Deleting...' : 'Delete'}</button>
                    </span>
                  </>
                )}
              </div>
            ))}
            {!loading && !visibleCustomers.length && <EmptyState title="No customers yet" description="Add a customer to start creating invoices." />}
          </div>
        </div>
      </section>
    </ProtectedPage>
  );
}
