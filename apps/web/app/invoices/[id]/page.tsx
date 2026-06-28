'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { Invoice } from '@billora/shared';
import { EmptyState } from '../../../components/empty-state';
import { LoadingState } from '../../../components/loading-state';
import { Message } from '../../../components/message';
import { ProtectedPage } from '../../../components/protected-page';
import { StatusBadge } from '../../../components/status-badge';
import { useToast } from '../../../components/toast-provider';
import { api } from '../../../lib/api';
import { getErrorMessage } from '../../../lib/errors';
import { formatMoney } from '../../../lib/format';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function InvoiceDetail() {
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setInvoice(await api.invoice(params.id));
  }

  useEffect(() => {
    load().catch((err) => setError(getErrorMessage(err, 'Unable to load invoice'))).finally(() => setLoading(false));
  }, [params.id]);

  const paidTotal = useMemo(() => {
    return invoice?.payments?.filter((payment) => payment.status === 'SUCCESS').reduce((sum, payment) => sum + Number(payment.amount), 0) ?? 0;
  }, [invoice]);

  const outstanding = Math.max(Number(invoice?.totalAmount ?? 0) - paidTotal, 0);

  async function action(task: () => Promise<unknown>, message: string) {
    setError('');
    setBusy(true);
    try {
      const result = await task();
      const actionMessage = typeof result === 'string' ? result : message;
      toast.success(actionMessage);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Action failed'));
    } finally {
      setBusy(false);
    }
  }

  async function recordPayment() {
    const amount = Number(paymentAmount);
    if (!amount) {
      setError('Enter a payment amount first.');
      return;
    }
    if (amount <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }
    if (outstanding && amount > outstanding) {
      setError('Payment amount cannot exceed the outstanding balance.');
      return;
    }
    await action(() => api.manualPayment({ invoiceId: params.id, amount, providerReference: paymentReference || undefined }), 'Manual payment recorded.');
    setPaymentAmount('');
    setPaymentReference('');
  }

  async function sendInvoice() {
    if (!invoice) return;
    await action(async () => {
      const result = await api.sendInvoice(invoice.id);
      return result.job?.queued ? 'Invoice sent and email job queued.' : result.message;
    }, 'Invoice marked as sent.');
    window.setTimeout(() => void load(), 1800);
  }

  async function generatePdf() {
    if (!invoice) return;
    await action(async () => {
      const result = await api.generateInvoicePdf(invoice.id);
      return result.job?.queued ? 'PDF generation queued.' : result.message;
    }, 'PDF generation requested.');
    window.setTimeout(() => void load(), 1800);
  }

  function downloadPdf() {
    if (!invoice) return;
    window.open(`${API_URL}/invoices/${invoice.id}/pdf`, '_blank', 'noopener,noreferrer');
  }

  return (
    <ProtectedPage>
      <section className="stack">
        <Link className="muted" href="/invoices">Back to invoices</Link>
        {!invoice ? (
          <div>{loading && <LoadingState label="Loading invoice..." />}<Message error={error} /></div>
        ) : (
          <>
            <div className="card invoice-header">
              <div>
                <StatusBadge status={invoice.status} />
                <h1>{invoice.invoiceNumber}</h1>
                <p>{invoice.customer?.name || 'Customer'} · Due {invoice.dueDate.slice(0, 10)}</p>
              </div>
              <div className="total-box">
                <span>Total</span>
                <strong>{formatMoney(invoice.totalAmount)}</strong>
                <small>Outstanding {formatMoney(outstanding)}</small>
              </div>
            </div>

            <div className="grid two">
              <div className="card">
                <h2>Line items</h2>
                <div className="table">
                  {invoice.items?.map((item) => (
                    <div className="table-row" key={item.id}>
                      <span><strong>{item.description}</strong><small>{item.quantity} x {formatMoney(item.unitPrice)} · Tax {item.taxRate}%</small></span>
                      <strong>{formatMoney(item.lineTotal)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h2>Summary</h2>
                <div className="summary-list">
                  <span>Subtotal <strong>{formatMoney(invoice.subtotal)}</strong></span>
                  <span>Tax <strong>{formatMoney(invoice.taxAmount)}</strong></span>
                  <span>Discount <strong>{formatMoney(invoice.discountAmount)}</strong></span>
                  <span>Total paid <strong>{formatMoney(paidTotal)}</strong></span>
                  <span>Total <strong>{formatMoney(invoice.totalAmount)}</strong></span>
                </div>
                {invoice.notes && <p>{invoice.notes}</p>}
                <div className="actions">
                  <button className="secondary" type="button" onClick={() => void generatePdf()} disabled={busy}>Generate PDF</button>
                  <button className="secondary" type="button" onClick={downloadPdf} disabled={busy}>Download PDF</button>
                  <button className="secondary" type="button" onClick={() => void sendInvoice()} disabled={busy || invoice.status !== 'DRAFT'}>Send</button>
                  <button type="button" onClick={() => void action(() => api.markInvoicePaid(invoice.id), 'Invoice marked paid.')} disabled={busy || invoice.status === 'PAID'}>Mark paid</button>
                </div>
                <div className="delivery-status">
                  <span>PDF <strong>{invoice.pdfStatus || 'NOT_GENERATED'}</strong></span>
                  <span>Email <strong>{invoice.emailStatus || 'NOT_SENT'}</strong></span>
                </div>
              </div>
            </div>

            <div className="grid two">
              <div className="card">
                <h2>Record payment</h2>
                <div className="grid two">
                  <label>Amount<input type="number" min="0.01" max={outstanding || undefined} step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></label>
                  <label>Reference<input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} /></label>
                </div>
                <div className="actions">
                  <button type="button" onClick={() => void recordPayment()} disabled={busy || outstanding <= 0}>{busy ? 'Recording...' : 'Record payment'}</button>
                </div>
                <Message error={error} />
              </div>

              <div className="card">
                <h2>Payments</h2>
                <div className="table">
                  {invoice.payments?.map((payment) => (
                    <div className="table-row" key={payment.id}>
                      <span><strong>{formatMoney(payment.amount)}</strong><small>{payment.provider} · {payment.status}</small></span>
                      <span>{payment.providerReference || 'No reference'}</span>
                    </div>
                  ))}
                  {!invoice.payments?.length && <EmptyState title="No payments recorded" description="Record a manual payment when money arrives." />}
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </ProtectedPage>
  );
}
