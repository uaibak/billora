import { BadRequestException, Injectable } from '@nestjs/common';
import { InvoiceStatus, PaymentProvider, PaymentStatus } from '@prisma/client';
import { InvoicesService } from '../invoices/invoices.service';
import { PrismaService } from '../prisma/prisma.service';
import { ManualPaymentDto } from './dto/manual-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService, private readonly invoices: InvoicesService) {}
  async manual(userId: string, dto: ManualPaymentDto) {
    await this.invoices.findOwned(userId, dto.invoiceId);
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: dto.invoiceId }, include: { payments: true } });
      const alreadyPaid = invoice.payments.filter((p) => p.status === PaymentStatus.SUCCESS).reduce((sum, p) => sum + Number(p.amount), 0);
      if (alreadyPaid + dto.amount > Number(invoice.totalAmount)) throw new BadRequestException('Payment exceeds outstanding balance');
      const payment = await tx.payment.create({ data: {
        invoiceId: dto.invoiceId, amount: dto.amount, providerReference: dto.providerReference,
        provider: PaymentProvider.MANUAL, status: PaymentStatus.SUCCESS, paidAt: new Date(),
      } });
      const totalPaid = alreadyPaid + dto.amount;
      await tx.invoice.update({ where: { id: dto.invoiceId }, data: { status: totalPaid >= Number(invoice.totalAmount) ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID } });
      return payment;
    }, { isolationLevel: 'Serializable' });
  }
  async forInvoice(userId: string, invoiceId: string) {
    await this.invoices.findOwned(userId, invoiceId);
    return this.prisma.payment.findMany({ where: { invoiceId }, orderBy: { createdAt: 'desc' } });
  }
}
