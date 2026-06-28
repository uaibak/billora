import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditAction, AuditEntityType, InvoiceStatus, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { getPagination, paginate } from '../common/dto/pagination.dto';
import { InvoicesService } from '../invoices/invoices.service';
import { PrismaService } from '../prisma/prisma.service';
import { ManualPaymentDto } from './dto/manual-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService, private readonly invoices: InvoicesService, private readonly audit: AuditService) {}
  async manual(userId: string, dto: ManualPaymentDto) {
    const ownedInvoice = await this.invoices.findOwned(userId, dto.invoiceId);
    await this.invoices.businesses.organizations.requireWritable(userId, ownedInvoice.business.organizationId);
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: dto.invoiceId }, include: { payments: true } });
      const alreadyPaid = invoice.payments.filter((p) => p.status === PaymentStatus.SUCCESS).reduce((sum, p) => sum + Number(p.amount), 0);
      if (alreadyPaid + dto.amount > Number(invoice.totalAmount)) throw new BadRequestException('Payment exceeds outstanding balance');
      const payment = await tx.payment.create({ data: {
        invoiceId: dto.invoiceId, amount: dto.amount, providerReference: dto.providerReference,
        provider: PaymentProvider.MANUAL, status: PaymentStatus.SUCCESS, paidAt: new Date(),
      } });
      const totalPaid = alreadyPaid + dto.amount;
      await tx.invoice.update({
        where: { id: dto.invoiceId },
        data: {
          status: totalPaid >= Number(invoice.totalAmount) ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID,
          pdfStatus: 'NOT_GENERATED',
          pdfPath: null,
          pdfGeneratedAt: null,
        },
      });
      await this.audit.record({
        organizationId: ownedInvoice.business.organizationId,
        userId,
        action: AuditAction.PAYMENT_RECORDED,
        entityType: AuditEntityType.PAYMENT,
        entityId: payment.id,
        metadata: { invoiceId: dto.invoiceId, invoiceNumber: ownedInvoice.invoiceNumber, amount: dto.amount, provider: PaymentProvider.MANUAL, totalPaid },
      }, tx);
      return payment;
    }, { isolationLevel: 'Serializable' });
  }
  async forInvoice(userId: string, invoiceId: string, query: PaymentQueryDto) {
    await this.invoices.findOwned(userId, invoiceId);
    const { status, provider, search } = query;
    const { page, limit } = getPagination(query);
    const where: Prisma.PaymentWhereInput = {
      invoiceId,
      ...(status ? { status } : {}),
      ...(provider ? { provider } : {}),
      ...(search ? { providerReference: { contains: search, mode: 'insensitive' } } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.payment.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }
}
