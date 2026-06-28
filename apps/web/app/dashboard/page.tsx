'use client';

import { useEffect, useState } from 'react';
import type { DashboardSummary } from '@billora/shared';
import { EmptyState } from '../../components/empty-state';
import { Message } from '../../components/message';
import { ProtectedPage } from '../../components/protected-page';
import { StatusBadge } from '../../components/status-badge';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { getErrorMessage } from '../../lib/errors';
import { formatMoney } from '../../lib/format';

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setSummary(await api.dashboardSummary());
      } catch (err) {
        setError(getErrorMessage(err, 'Unable to load dashboard'));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const drafts = summary?.byStatus?.DRAFT ?? 0;

  return (
    <ProtectedPage>
      <section className="stack">
        <div className="card">
          <p className="eyebrow">Welcome back</p>
          <h1>{user?.fullName || 'Billora user'}</h1>
          <p>Clear invoices, confident payments, and a cleaner view of every customer balance.</p>
          <Message error={error} />
        </div>
        <div className="grid four">
          <article className="card metric"><span>Businesses</span><strong>{summary?.businesses ?? 0}</strong></article>
          <article className="card metric"><span>Customers</span><strong>{summary?.customers ?? 0}</strong></article>
          <article className="card metric"><span>Invoices</span><strong>{summary?.invoices ?? 0}</strong></article>
          <article className="card metric"><span>Outstanding</span><strong>{formatMoney(summary?.outstanding)}</strong></article>
        </div>
        <div className="grid four">
          <article className="card metric"><span>Collected</span><strong>{formatMoney(summary?.collected)}</strong></article>
          <article className="card metric"><span>Sent value</span><strong>{formatMoney(summary?.sent)}</strong></article>
          <article className="card metric"><span>Overdue</span><strong>{formatMoney(summary?.overdue)}</strong></article>
          <article className="card metric"><span>Drafts</span><strong>{drafts}</strong></article>
        </div>
        <div className="card">
          <div className="section-heading">
            <div>
              <h2>Recent invoices</h2>
              <p>Latest invoices across all businesses.</p>
            </div>
          </div>
          <div className="table">
            {loading && <p className="muted">Loading dashboard data...</p>}
            {summary?.recentInvoices.map((invoice) => (
              <div className="table-row" key={invoice.id}>
                <span><strong>{invoice.invoiceNumber}</strong><small>{invoice.customer?.name || invoice.business?.name || 'Invoice'}</small></span>
                <StatusBadge status={invoice.status} />
                <strong>{formatMoney(invoice.totalAmount)}</strong>
              </div>
            ))}
            {!loading && !summary?.recentInvoices.length && <EmptyState title="No invoices yet" description="Create your first invoice from the invoices page." />}
          </div>
        </div>
      </section>
    </ProtectedPage>
  );
}
