'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Business, Customer, Invoice } from '@billora/shared';
import { EmptyState } from '../../components/empty-state';
import { Message } from '../../components/message';
import { ProtectedPage } from '../../components/protected-page';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { getErrorMessage } from '../../lib/errors';
import { formatMoney } from '../../lib/format';

export default function Dashboard() {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [businessData, customerData, invoiceData] = await Promise.all([api.businesses(), api.customers(), api.invoices()]);
        setBusinesses(businessData);
        setCustomers(customerData);
        setInvoices(invoiceData);
      } catch (err) {
        setError(getErrorMessage(err, 'Unable to load dashboard'));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const totals = useMemo(() => {
    const paid = invoices.filter((invoice) => invoice.status === 'PAID').reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);
    const outstanding = invoices.filter((invoice) => !['PAID', 'CANCELLED'].includes(invoice.status)).reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);
    return { paid, outstanding };
  }, [invoices]);

  return (
    <ProtectedPage>
      <section className="stack">
        <div className="card">
          <p className="eyebrow">Welcome back</p>
          <h1>{user?.fullName || 'Billora user'}</h1>
          <p>Your invoicing workspace is connected to the live API.</p>
          <Message error={error} />
        </div>
        <div className="grid four">
          <article className="card metric"><span>Businesses</span><strong>{businesses.length}</strong></article>
          <article className="card metric"><span>Customers</span><strong>{customers.length}</strong></article>
          <article className="card metric"><span>Invoices</span><strong>{invoices.length}</strong></article>
          <article className="card metric"><span>Outstanding</span><strong>{formatMoney(totals.outstanding)}</strong></article>
        </div>
        <div className="card">
          <h2>Recent invoices</h2>
          <div className="table">
            {loading && <p className="muted">Loading dashboard data...</p>}
            {invoices.slice(0, 5).map((invoice) => (
              <div className="table-row" key={invoice.id}>
                <span>{invoice.invoiceNumber}</span>
                <span>{invoice.status.replace('_', ' ')}</span>
                <strong>{formatMoney(invoice.totalAmount)}</strong>
              </div>
            ))}
            {!loading && !invoices.length && <EmptyState title="No invoices yet" description="Create your first invoice from the invoices page." />}
          </div>
        </div>
      </section>
    </ProtectedPage>
  );
}
