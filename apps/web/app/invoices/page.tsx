'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Business, Customer, Invoice } from '@billora/shared';
import { EmptyState } from '../../components/empty-state';
import { SkeletonList } from '../../components/loading-state';
import { Message } from '../../components/message';
import { Pagination } from '../../components/pagination';
import { ProtectedPage } from '../../components/protected-page';
import { StatusBadge } from '../../components/status-badge';
import { useToast } from '../../components/toast-provider';
import { api, InvoiceInputItem, PaginationMeta } from '../../lib/api';
import { confirmAction, getErrorMessage } from '../../lib/errors';
import { formatMoney, inDays, today } from '../../lib/format';
import { validateInvoiceItems } from '../../lib/validators';

const emptyItem: InvoiceInputItem = { description: '', quantity: 1, unitPrice: 0, taxRate: 0 };

export default function Invoices() {
  const toast = useToast();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [customerId, setCustomerId] = useState('');
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(inDays(14));
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<InvoiceInputItem[]>([{ ...emptyItem }]);
  const [editingId, setEditingId] = useState('');
  const [editCustomerId, setEditCustomerId] = useState('');
  const [editIssueDate, setEditIssueDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editDiscountAmount, setEditDiscountAmount] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [editItems, setEditItems] = useState<InvoiceInputItem[]>([{ ...emptyItem }]);
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});
  const [paymentReferences, setPaymentReferences] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  async function load() {
    const [businessData, customerData, invoiceData] = await Promise.all([
      api.businesses(),
      api.customers(),
      api.invoicesPaginated({ businessId, search, status: statusFilter, page, limit: 10 }),
    ]);
    const selectedBusinessId = businessId || businessData[0]?.id || '';
    const selectedCustomerId = customerData.find((customer) => customer.id === customerId && customer.businessId === selectedBusinessId)?.id
      || customerData.find((customer) => customer.businessId === selectedBusinessId)?.id
      || '';
    setBusinesses(businessData);
    setCustomers(customerData);
    setInvoices(invoiceData.data);
    setMeta(invoiceData.meta);
    setBusinessId(selectedBusinessId);
    setCustomerId(selectedCustomerId);
  }

  useEffect(() => {
    load().catch((err) => setError(getErrorMessage(err, 'Unable to load invoices'))).finally(() => setLoading(false));
  }, [businessId, page, search, statusFilter]);

  const preview = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
    const tax = items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitPrice || 0) * Number(item.taxRate || 0)) / 100, 0);
    return { subtotal, tax, total: Math.max(subtotal + tax - Number(discountAmount || 0), 0) };
  }, [items, discountAmount]);

  const selectedBusiness = businesses.find((business) => business.id === businessId);
  const selectedCustomer = customers.find((customer) => customer.id === customerId);

  function updateItem(index: number, patch: Partial<InvoiceInputItem>) {
    setItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!businessId) {
      setError('Create a business profile in settings before creating invoices.');
      return;
    }
    if (!customerId) {
      setError('Create a customer before creating invoices.');
      return;
    }
    const itemError = validateInvoiceItems(items);
    if (itemError) {
      setError(itemError);
      return;
    }
    if (new Date(dueDate) < new Date(issueDate)) {
      setError('Due date cannot be before issue date.');
      return;
    }
    setSubmitting(true);
    try {
      await api.createInvoice({
        businessId,
        customerId,
        issueDate,
        dueDate,
        discountAmount: Number(discountAmount || 0),
        notes: notes || undefined,
        items: items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate || 0),
        })),
      });
      toast.success('Invoice created.');
      setItems([{ ...emptyItem }]);
      setNotes('');
      setDiscountAmount(0);
      setPage(1);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to create invoice'));
    } finally {
      setSubmitting(false);
    }
  }

  async function invoiceAction(action: () => Promise<unknown>, message: string, id = '') {
    setError('');
    setBusyId(id);
    try {
      const result = await action();
      const actionMessage = typeof result === 'string' ? result : message;
      toast.success(actionMessage);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Invoice action failed'));
    } finally {
      setBusyId('');
    }
  }

  async function sendInvoice(invoice: Invoice) {
    await invoiceAction(async () => {
      const result = await api.sendInvoice(invoice.id);
      return result.job?.queued ? 'Invoice sent and email job queued.' : result.message;
    }, 'Invoice marked as sent.', invoice.id);
    window.setTimeout(() => void load(), 1800);
  }

  async function generatePdf(invoice: Invoice) {
    await invoiceAction(async () => {
      const result = await api.generateInvoicePdf(invoice.id);
      return result.job?.queued ? 'PDF generation queued.' : result.message;
    }, 'PDF generation requested.', invoice.id);
    window.setTimeout(() => void load(), 1800);
  }

  function startEdit(invoice: Invoice) {
    setEditingId(invoice.id);
    setEditCustomerId(invoice.customerId);
    setEditIssueDate(invoice.issueDate.slice(0, 10));
    setEditDueDate(invoice.dueDate.slice(0, 10));
    setEditDiscountAmount(Number(invoice.discountAmount));
    setEditNotes(invoice.notes ?? '');
    setEditItems(invoice.items?.length ? invoice.items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      taxRate: Number(item.taxRate),
    })) : [{ ...emptyItem }]);
  }

  function updateEditItem(index: number, patch: Partial<InvoiceInputItem>) {
    setEditItems(editItems.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function saveEdit(id: string) {
    const itemError = validateInvoiceItems(editItems);
    if (itemError) {
      setError(itemError);
      return;
    }
    if (new Date(editDueDate) < new Date(editIssueDate)) {
      setError('Due date cannot be before issue date.');
      return;
    }
    await invoiceAction(() => api.updateInvoice(id, {
      customerId: editCustomerId,
      issueDate: editIssueDate,
      dueDate: editDueDate,
      discountAmount: Number(editDiscountAmount || 0),
      notes: editNotes || undefined,
      items: editItems.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.taxRate || 0),
      })),
    }), 'Invoice updated.', id);
    setEditingId('');
  }

  async function recordPayment(invoice: Invoice) {
    const amount = Number(paymentAmounts[invoice.id] || 0);
    if (!amount) {
      setError('Enter a payment amount first.');
      return;
    }
    if (amount <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }
    await invoiceAction(() => api.manualPayment({
      invoiceId: invoice.id,
      amount,
      providerReference: paymentReferences[invoice.id] || undefined,
    }), 'Manual payment recorded.', invoice.id);
    setPaymentAmounts({ ...paymentAmounts, [invoice.id]: '' });
    setPaymentReferences({ ...paymentReferences, [invoice.id]: '' });
  }

  const visibleCustomers = businessId ? customers.filter((customer) => customer.businessId === businessId) : customers;
  const visibleInvoices = invoices;

  function deleteInvoice(invoice: Invoice) {
    if (!confirmAction(`Delete invoice ${invoice.invoiceNumber}? This cannot be undone.`)) return;
    void invoiceAction(() => api.deleteInvoice(invoice.id), 'Invoice deleted.', invoice.id);
  }

  function paidTotal(invoice: Invoice) {
    return invoice.payments?.filter((payment) => payment.status === 'SUCCESS').reduce((sum, payment) => sum + Number(payment.amount), 0) ?? 0;
  }

  function outstandingTotal(invoice: Invoice) {
    return Math.max(Number(invoice.totalAmount) - paidTotal(invoice), 0);
  }

  return (
    <ProtectedPage>
      <section className="stack">
        <div className="card">
          <h1>Create invoice</h1>
          <p>Add line items and Billora will calculate subtotal, tax, discount, and total.</p>
          <form className="stack" onSubmit={onSubmit}>
            <div className="grid two">
              <div className="card subtle">
                <p className="eyebrow">From</p>
                <strong>{selectedBusiness?.name || 'Select a business'}</strong>
                <p>{[selectedBusiness?.email, selectedBusiness?.city, selectedBusiness?.country].filter(Boolean).join(' · ') || 'Business sender details will appear here.'}</p>
              </div>
              <div className="card subtle">
                <p className="eyebrow">Bill to</p>
                <strong>{selectedCustomer?.name || 'Select a customer'}</strong>
                <p>{[selectedCustomer?.email, selectedCustomer?.city, selectedCustomer?.country].filter(Boolean).join(' · ') || 'Customer billing details will appear here.'}</p>
              </div>
            </div>
            <div className="grid two">
              <label>Business
                <select value={businessId} onChange={(event) => {
                  setBusinessId(event.target.value);
                  setPage(1);
                  const nextCustomer = customers.find((customer) => customer.businessId === event.target.value);
                  setCustomerId(nextCustomer?.id ?? '');
                }} required>
                  <option value="">Select business</option>
                  {businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
                </select>
              </label>
              <label>Customer
                <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} required>
                  <option value="">Select customer</option>
                  {visibleCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                </select>
              </label>
              <label>Discount<input type="number" min="0" step="0.01" value={discountAmount} onChange={(event) => setDiscountAmount(Number(event.target.value))} /></label>
              <label>Issue date<input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} required /></label>
              <label>Due date<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required /></label>
            </div>

            <div className="items">
              <div className="item-row item-head">
                <span>Description</span>
                <span>Qty</span>
                <span>Unit price</span>
                <span>Tax %</span>
                <span>Total</span>
              </div>
              {items.map((item, index) => (
                <div className="item-row" key={index}>
                  <input placeholder="Description" value={item.description} onChange={(event) => updateItem(index, { description: event.target.value })} required />
                  <input aria-label="Quantity" type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} required />
                  <input aria-label="Unit price" type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value) })} required />
                  <input aria-label="Tax rate" type="number" min="0" step="0.01" value={item.taxRate} onChange={(event) => updateItem(index, { taxRate: Number(event.target.value) })} />
                  <span className="line-total">
                    {formatMoney(Number(item.quantity || 0) * Number(item.unitPrice || 0) * (1 + Number(item.taxRate || 0) / 100))}
                    <button className="secondary" type="button" onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))} disabled={items.length === 1}>Remove</button>
                  </span>
                </div>
              ))}
              <button className="secondary" type="button" onClick={() => setItems([...items, { ...emptyItem }])}>Add item</button>
            </div>

            <label>Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} /></label>
            <div className="total-preview">
              <span>Subtotal {formatMoney(preview.subtotal)}</span>
              <span>Tax {formatMoney(preview.tax)}</span>
              <strong>Total {formatMoney(preview.total)}</strong>
            </div>
            <Message error={error} />
            <button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create invoice'}</button>
          </form>
        </div>

        <div className="card">
          <div className="section-heading">
            <div>
              <h2>Invoices</h2>
              <p>{meta ? `${meta.total} invoice${meta.total === 1 ? '' : 's'} found` : 'Manage invoice records'}</p>
            </div>
            <div className="filters">
              <label>Search<input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Invoice, customer, notes..." /></label>
              <label>Status
                <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
                  <option value="">All statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SENT">Sent</option>
                  <option value="PARTIALLY_PAID">Partially paid</option>
                  <option value="PAID">Paid</option>
                  <option value="OVERDUE">Overdue</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </label>
            </div>
          </div>
          <div className="table">
            {loading && <SkeletonList rows={5} />}
            {visibleInvoices.map((invoice) => (
              <div className="table-row invoice-row" key={invoice.id}>
                {editingId === invoice.id ? (
                  <>
                    <span className="inline-edit">
                      <select value={editCustomerId} onChange={(event) => setEditCustomerId(event.target.value)} required>
                        {customers.filter((customer) => customer.businessId === invoice.businessId).map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                      </select>
                      <input type="date" value={editIssueDate} onChange={(event) => setEditIssueDate(event.target.value)} required />
                      <input type="date" value={editDueDate} onChange={(event) => setEditDueDate(event.target.value)} required />
                      <input type="number" min="0" step="0.01" value={editDiscountAmount} onChange={(event) => setEditDiscountAmount(Number(event.target.value))} />
                      {editItems.map((item, index) => (
                        <span className="item-row compact" key={index}>
                          <input value={item.description} onChange={(event) => updateEditItem(index, { description: event.target.value })} placeholder="Description" required />
                          <input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => updateEditItem(index, { quantity: Number(event.target.value) })} required />
                          <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateEditItem(index, { unitPrice: Number(event.target.value) })} required />
                          <input type="number" min="0" step="0.01" value={item.taxRate} onChange={(event) => updateEditItem(index, { taxRate: Number(event.target.value) })} />
                          <button className="secondary" type="button" onClick={() => setEditItems(editItems.filter((_, itemIndex) => itemIndex !== index))} disabled={editItems.length === 1}>Remove</button>
                        </span>
                      ))}
                      <button className="secondary" type="button" onClick={() => setEditItems([...editItems, { ...emptyItem }])}>Add line</button>
                      <textarea value={editNotes} onChange={(event) => setEditNotes(event.target.value)} rows={2} />
                    </span>
                    <span>{formatMoney(invoice.totalAmount)}</span>
                    <span className="actions small">
                      <button type="button" onClick={() => void saveEdit(invoice.id)} disabled={busyId === invoice.id}>Save</button>
                      <button className="secondary" type="button" onClick={() => setEditingId('')}>Cancel</button>
                    </span>
                  </>
                ) : (
                  <>
                    <span><strong><Link href={`/invoices/${invoice.id}`}>{invoice.invoiceNumber}</Link></strong><small>{invoice.customer?.name || 'Customer'} · <StatusBadge status={invoice.status} /></small></span>
                    <span><strong>{formatMoney(invoice.totalAmount)}</strong><small>Due {formatMoney(outstandingTotal(invoice))}</small></span>
                    <span className="actions small">
                      <input aria-label="Payment amount" className="small-input" type="number" min="0.01" step="0.01" placeholder="Amount" value={paymentAmounts[invoice.id] ?? ''} onChange={(event) => setPaymentAmounts({ ...paymentAmounts, [invoice.id]: event.target.value })} />
                      <input aria-label="Payment reference" className="small-input" placeholder="Reference" value={paymentReferences[invoice.id] ?? ''} onChange={(event) => setPaymentReferences({ ...paymentReferences, [invoice.id]: event.target.value })} />
                      <button className="secondary" type="button" onClick={() => startEdit(invoice)} disabled={Boolean(busyId)}>Edit</button>
                      <button className="secondary" type="button" onClick={() => void generatePdf(invoice)} disabled={busyId === invoice.id}>PDF</button>
                      <button className="secondary" type="button" onClick={() => void sendInvoice(invoice)} disabled={busyId === invoice.id || invoice.status !== 'DRAFT'}>Send</button>
                      <button type="button" onClick={() => void recordPayment(invoice)} disabled={busyId === invoice.id || outstandingTotal(invoice) <= 0}>{busyId === invoice.id ? 'Working...' : 'Pay'}</button>
                      <button className="danger secondary" type="button" onClick={() => deleteInvoice(invoice)} disabled={busyId === invoice.id}>Delete</button>
                    </span>
                  </>
                )}
              </div>
            ))}
            {!loading && !visibleInvoices.length && <EmptyState title="No invoices yet" description="Create an invoice once you have a business and customer." />}
          </div>
          <Pagination meta={meta} page={page} onPageChange={setPage} />
        </div>
      </section>
    </ProtectedPage>
  );
}
