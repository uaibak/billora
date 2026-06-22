import { InvoiceStatus, PaymentProvider, PaymentStatus, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'demo@billora.app' },
    update: { fullName: 'Billora Demo', passwordHash: await bcrypt.hash('Password123!', 12) },
    create: { email: 'demo@billora.app', fullName: 'Billora Demo', passwordHash: await bcrypt.hash('Password123!', 12) },
  });
  await prisma.business.deleteMany({ where: { userId: user.id } });
  const business = await prisma.business.create({ data: {
    userId: user.id, name: 'Billora Demo Studio', email: 'billing@billora.app',
    phone: '+92 300 0000000', city: 'Karachi', country: 'Pakistan', taxNumber: 'DEMO-TAX-001',
  } });
  const [acme, northstar] = await Promise.all([
    prisma.customer.create({ data: { businessId: business.id, name: 'Acme Trading', email: 'accounts@acme.test', city: 'Karachi', country: 'Pakistan' } }),
    prisma.customer.create({ data: { businessId: business.id, name: 'Northstar Labs', email: 'finance@northstar.test', city: 'Lahore', country: 'Pakistan' } }),
  ]);
  const first = await prisma.invoice.create({ data: {
    businessId: business.id, customerId: acme.id, invoiceNumber: 'BIL-2026-000001',
    issueDate: new Date('2026-06-01'), dueDate: new Date('2026-06-15'), status: InvoiceStatus.PARTIALLY_PAID,
    subtotal: 1000, taxAmount: 150, discountAmount: 50, totalAmount: 1100, notes: 'Thank you for your business.',
    items: { create: [
      { description: 'Brand identity design', quantity: 1, unitPrice: 800, taxRate: 15, lineTotal: 800 },
      { description: 'Stationery pack', quantity: 1, unitPrice: 200, taxRate: 15, lineTotal: 200 },
    ] },
  } });
  await prisma.invoice.create({ data: {
    businessId: business.id, customerId: northstar.id, invoiceNumber: 'BIL-2026-000002',
    issueDate: new Date('2026-06-20'), dueDate: new Date('2026-07-04'), status: InvoiceStatus.DRAFT,
    subtotal: 1500, taxAmount: 225, discountAmount: 0, totalAmount: 1725,
    items: { create: [{ description: 'Product design sprint', quantity: 3, unitPrice: 500, taxRate: 15, lineTotal: 1500 }] },
  } });
  await prisma.payment.create({ data: {
    invoiceId: first.id, amount: 500, provider: PaymentProvider.MANUAL, status: PaymentStatus.SUCCESS,
    providerReference: 'DEMO-CASH-001', paidAt: new Date('2026-06-10'),
  } });
  console.log('Seeded demo@billora.app / Password123!');
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());
