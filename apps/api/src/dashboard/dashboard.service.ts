import { Injectable } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { OrganizationsService } from '../organizations/organizations.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService, private readonly organizations: OrganizationsService) {}

  async summary(userId: string, organizationId?: string) {
    const orgId = organizationId ?? await this.organizations.defaultOrganizationId(userId);
    await this.organizations.findMember(userId, orgId);
    const businessWhere: Prisma.BusinessWhereInput = { organizationId: orgId };
    const invoiceWhere: Prisma.InvoiceWhereInput = { business: { organizationId: orgId } };
    const [businesses, customers, invoices] = await this.prisma.$transaction([
      this.prisma.business.count({ where: businessWhere }),
      this.prisma.customer.count({ where: { business: { organizationId: orgId } } }),
      this.prisma.invoice.findMany({ where: invoiceWhere, select: { id: true, status: true, totalAmount: true, dueDate: true, createdAt: true, invoiceNumber: true, customer: { select: { name: true } }, business: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);

    const closedStatuses: InvoiceStatus[] = [InvoiceStatus.PAID, InvoiceStatus.CANCELLED];
    const totals = invoices.reduce((acc, invoice) => {
      const amount = Number(invoice.totalAmount);
      acc.total += amount;
      if (invoice.status === InvoiceStatus.PAID) acc.collected += amount;
      if (invoice.status === InvoiceStatus.SENT) acc.sent += amount;
      if (!closedStatuses.includes(invoice.status)) acc.outstanding += amount;
      if (invoice.status === InvoiceStatus.OVERDUE || (invoice.status !== InvoiceStatus.PAID && invoice.dueDate < new Date())) acc.overdue += amount;
      acc.byStatus[invoice.status] = (acc.byStatus[invoice.status] ?? 0) + 1;
      return acc;
    }, { total: 0, collected: 0, sent: 0, outstanding: 0, overdue: 0, byStatus: {} as Record<string, number> });

    return { organizationId: orgId, businesses, customers, invoices: invoices.length, ...totals, recentInvoices: invoices.slice(0, 6) };
  }
}
