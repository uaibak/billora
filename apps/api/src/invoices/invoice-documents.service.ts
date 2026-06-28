import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { PrismaService } from '../prisma/prisma.service';

const invoiceInclude = { customer: true, business: true, items: true, payments: true } as const;

@Injectable()
export class InvoiceDocumentsService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async generate(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: invoiceInclude });
    const outputDir = this.config.get<string>('INVOICE_STORAGE_DIR') ?? 'storage/invoices';
    const filePath = join(outputDir, `${invoice.invoiceNumber}.html`);
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, this.renderHtml(invoice), 'utf8');
    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { pdfStatus: 'GENERATED', pdfPath: filePath, pdfGeneratedAt: new Date() },
      include: invoiceInclude,
    });
  }

  async read(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    if (!invoice.pdfPath) return null;
    return fs.readFile(invoice.pdfPath);
  }

  private renderHtml(invoice: any) {
    const rows = invoice.items.map((item: any) => `
      <tr>
        <td>${escapeHtml(item.description)}</td>
        <td class="right">${item.quantity}</td>
        <td class="right">${money(item.unitPrice)}</td>
        <td class="right">${item.taxRate}%</td>
        <td class="right">${money(item.lineTotal)}</td>
      </tr>
    `).join('');
    const recordedPaid = invoice.payments
      .filter((payment: any) => payment.status === 'SUCCESS')
      .reduce((sum: number, payment: any) => sum + Number(payment.amount), 0);
    const paidAmount = invoice.status === 'PAID' ? Math.max(recordedPaid, Number(invoice.totalAmount)) : recordedPaid;
    const balanceDue = Math.max(Number(invoice.totalAmount) - paidAmount, 0);
    const paymentRows = invoice.payments.length ? invoice.payments.map((payment: any) => `
      <tr>
        <td>${payment.paidAt ? payment.paidAt.toISOString().slice(0, 10) : payment.createdAt.toISOString().slice(0, 10)}</td>
        <td>${escapeHtml(payment.provider.replaceAll('_', ' '))}</td>
        <td>${escapeHtml(payment.providerReference || 'Manual entry')}</td>
        <td class="right">${escapeHtml(payment.status.replaceAll('_', ' '))}</td>
        <td class="right">${money(payment.amount)}</td>
      </tr>
    `).join('') : '';
    const businessAddress = [invoice.business.address, invoice.business.city, invoice.business.country].filter(Boolean).map(escapeHtml).join(', ');
    const customerAddress = [invoice.customer.address, invoice.customer.city, invoice.customer.country].filter(Boolean).map(escapeHtml).join(', ');

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${invoice.invoiceNumber}</title>
  <style>
    :root { --ink: #102033; --muted: #64748b; --line: #e2e8f0; --blue: #1f6feb; --green: #10b981; }
    * { box-sizing: border-box; }
    body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); margin: 0; background: #f8fafc; }
    .page { max-width: 920px; margin: 0 auto; padding: 48px; background: #fff; min-height: 100vh; }
    .topbar { height: 10px; border-radius: 999px; background: linear-gradient(90deg, var(--blue), var(--green)); margin-bottom: 34px; }
    .header { display: flex; justify-content: space-between; gap: 32px; align-items: flex-start; margin-bottom: 38px; }
    .brand { display: flex; gap: 14px; align-items: center; }
    .mark { width: 46px; height: 46px; display: grid; place-items: center; border-radius: 16px; color: #fff; font-weight: 900; background: linear-gradient(135deg, var(--blue), var(--green)); }
    h1 { margin: 0; font-size: 42px; letter-spacing: -0.05em; }
    h2 { margin: 0 0 10px; font-size: 14px; text-transform: uppercase; letter-spacing: .12em; color: var(--muted); }
    p { margin: 4px 0; color: var(--muted); line-height: 1.5; }
    .status { display: inline-block; margin-top: 10px; padding: 6px 10px; border-radius: 999px; background: #eff6ff; color: #174ea6; font-size: 12px; font-weight: 800; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 34px; }
    .panel { border: 1px solid var(--line); border-radius: 18px; padding: 18px; background: #fbfdff; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; overflow: hidden; border-radius: 18px; }
    th { background: #f1f5f9; color: #475569; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
    th, td { border-bottom: 1px solid var(--line); padding: 14px 12px; text-align: left; }
    .right { text-align: right; }
    .summary { margin-top: 28px; margin-left: auto; width: 320px; border: 1px solid var(--line); border-radius: 18px; padding: 16px 18px; background: #fbfdff; }
    .summary div { display: flex; justify-content: space-between; padding: 8px 0; color: var(--muted); }
    .summary div:last-child { margin-top: 8px; padding-top: 14px; border-top: 1px solid var(--line); color: var(--ink); font-size: 20px; }
    .summary .paid strong { color: var(--green); }
    .summary .balance { color: var(--ink); font-size: 16px; }
    .summary .balance strong { color: ${balanceDue > 0 ? '#dc2626' : 'var(--green)'}; }
    .payment-note { margin-top: 10px; color: var(--muted); font-size: 12px; text-align: right; }
    .notes { margin-top: 28px; padding: 18px; border-radius: 18px; background: #fffbeb; color: #92400e; }
    .footer { margin-top: 42px; padding-top: 18px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; }
    @media print { body { background: #fff; } .page { padding: 24px; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="topbar"></div>
    <div class="header">
      <div class="brand">
        <div class="mark">B</div>
        <div>
          <h1>Invoice</h1>
          <p>${invoice.invoiceNumber}</p>
          <span class="status">${invoice.status.replaceAll('_', ' ')}</span>
        </div>
      </div>
      <div class="right">
        <p><strong>Issue</strong> ${invoice.issueDate.toISOString().slice(0, 10)}</p>
        <p><strong>Due</strong> ${invoice.dueDate.toISOString().slice(0, 10)}</p>
      </div>
    </div>
    <div class="parties">
      <div class="panel">
        <h2>From</h2>
        <p><strong>${escapeHtml(invoice.business.name)}</strong></p>
        ${invoice.business.email ? `<p>${escapeHtml(invoice.business.email)}</p>` : ''}
        ${invoice.business.phone ? `<p>${escapeHtml(invoice.business.phone)}</p>` : ''}
        ${businessAddress ? `<p>${businessAddress}</p>` : ''}
        ${invoice.business.taxNumber ? `<p>Tax: ${escapeHtml(invoice.business.taxNumber)}</p>` : ''}
      </div>
      <div class="panel">
        <h2>Bill to</h2>
        <p><strong>${escapeHtml(invoice.customer.name)}</strong></p>
        ${invoice.customer.email ? `<p>${escapeHtml(invoice.customer.email)}</p>` : ''}
        ${invoice.customer.phone ? `<p>${escapeHtml(invoice.customer.phone)}</p>` : ''}
        ${customerAddress ? `<p>${customerAddress}</p>` : ''}
      </div>
    </div>
    <table>
      <thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Unit</th><th class="right">Tax</th><th class="right">Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="summary">
      <div><span>Subtotal</span><strong>${money(invoice.subtotal)}</strong></div>
      <div><span>Tax</span><strong>${money(invoice.taxAmount)}</strong></div>
      <div><span>Discount</span><strong>${money(invoice.discountAmount)}</strong></div>
      <div><span>Total</span><strong>${money(invoice.totalAmount)}</strong></div>
      <div class="paid"><span>Paid</span><strong>${money(paidAmount)}</strong></div>
      <div class="balance"><span>Balance due</span><strong>${money(balanceDue)}</strong></div>
    </div>
    ${invoice.status === 'PAID' && paidAmount > recordedPaid ? '<p class="payment-note">This invoice was marked as paid.</p>' : ''}
    ${paymentRows ? `
    <table>
      <thead><tr><th>Date</th><th>Provider</th><th>Reference</th><th class="right">Status</th><th class="right">Amount</th></tr></thead>
      <tbody>${paymentRows}</tbody>
    </table>` : ''}
    ${invoice.notes ? `<div class="notes">${escapeHtml(invoice.notes)}</div>` : ''}
    <div class="footer">Generated by Billora on ${new Date().toISOString().slice(0, 10)}.</div>
  </div>
</body>
</html>`;
  }
}

function money(value: unknown) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char] ?? char);
}
