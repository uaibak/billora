import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { BusinessesService } from '../businesses/businesses.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto, InvoiceItemDto, UpdateInvoiceDto } from './dto/invoice.dto';

const invoiceInclude = { customer: true, business: true, items: true, payments: true } as const;

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService, private readonly businesses: BusinessesService) {}

  async create(userId: string, dto: CreateInvoiceDto) {
    await this.businesses.findOwned(userId, dto.businessId);
    await this.ensureCustomer(dto.customerId, dto.businessId);
    this.validateDates(dto.issueDate, dto.dueDate);
    const totals = this.calculate(dto.items, dto.discountAmount);

    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.invoice.findFirst({ where: { invoiceNumber: { startsWith: `BIL-${new Date(dto.issueDate).getUTCFullYear()}-` } }, orderBy: { invoiceNumber: 'desc' }, select: { invoiceNumber: true } });
      const sequence = latest ? Number(latest.invoiceNumber.split('-').at(-1)) + 1 : 1;
      const invoiceNumber = `BIL-${new Date(dto.issueDate).getUTCFullYear()}-${String(sequence).padStart(6, '0')}`;
      return tx.invoice.create({
        data: {
          businessId: dto.businessId, customerId: dto.customerId, invoiceNumber,
          issueDate: new Date(dto.issueDate), dueDate: new Date(dto.dueDate), notes: dto.notes,
          ...totals,
          items: { create: this.itemData(dto.items) },
        }, include: invoiceInclude,
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  findAll(userId: string) {
    return this.prisma.invoice.findMany({ where: { business: { userId } }, include: invoiceInclude, orderBy: { createdAt: 'desc' } });
  }
  async findOwned(userId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, business: { userId } }, include: invoiceInclude });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }
  findOne(userId: string, id: string) { return this.findOwned(userId, id); }

  async update(userId: string, id: string, dto: UpdateInvoiceDto) {
    const invoice = await this.findOwned(userId, id);
    if (dto.customerId) await this.ensureCustomer(dto.customerId, invoice.businessId);
    const issueDate = dto.issueDate ?? invoice.issueDate.toISOString();
    const dueDate = dto.dueDate ?? invoice.dueDate.toISOString();
    this.validateDates(issueDate, dueDate);
    const { items, ...fields } = dto;
    const totals: { subtotal?: number; taxAmount?: number; discountAmount?: number; totalAmount?: number } = items ? this.calculate(items, dto.discountAmount ?? Number(invoice.discountAmount)) :
      dto.discountAmount !== undefined ? { discountAmount: dto.discountAmount, totalAmount: Number(invoice.subtotal) + Number(invoice.taxAmount) - dto.discountAmount } : {};
    if (totals.totalAmount !== undefined && totals.totalAmount < 0) throw new BadRequestException('Discount cannot exceed invoice amount');
    const paid = invoice.payments.filter((payment) => payment.status === 'SUCCESS').reduce((sum, payment) => sum + Number(payment.amount), 0);
    if (totals.totalAmount !== undefined && totals.totalAmount < paid) throw new BadRequestException('Invoice total cannot be less than payments received');

    return this.prisma.$transaction(async (tx) => {
      if (items) await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      return tx.invoice.update({ where: { id }, data: {
        ...fields, issueDate: new Date(issueDate), dueDate: new Date(dueDate), ...totals,
        ...(items ? { items: { create: this.itemData(items) } } : {}),
      }, include: invoiceInclude });
    });
  }

  async remove(userId: string, id: string) {
    await this.findOwned(userId, id);
    await this.prisma.invoice.delete({ where: { id } });
    return { message: 'Invoice deleted' };
  }
  async send(userId: string, id: string) {
    const invoice = await this.findOwned(userId, id);
    if (invoice.status !== InvoiceStatus.DRAFT) throw new BadRequestException('Only draft invoices can be sent');
    const updated = await this.prisma.invoice.update({ where: { id }, data: { status: InvoiceStatus.SENT } });
    return { message: 'Invoice marked as sent; email delivery will be added later', invoice: updated };
  }
  async markPaid(userId: string, id: string) {
    await this.findOwned(userId, id);
    return this.prisma.invoice.update({ where: { id }, data: { status: InvoiceStatus.PAID }, include: invoiceInclude });
  }

  private async ensureCustomer(customerId: string, businessId: string) {
    if (!(await this.prisma.customer.findFirst({ where: { id: customerId, businessId } }))) throw new BadRequestException('Customer does not belong to this business');
  }
  private validateDates(issue: string, due: string) {
    if (new Date(due) < new Date(issue)) throw new BadRequestException('Due date cannot be before issue date');
  }
  private calculate(items: InvoiceItemDto[], discountAmount: number) {
    const subtotal = this.money(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
    const taxAmount = this.money(items.reduce((sum, item) => sum + item.quantity * item.unitPrice * item.taxRate / 100, 0));
    const totalAmount = this.money(subtotal + taxAmount - discountAmount);
    if (totalAmount < 0) throw new BadRequestException('Discount cannot exceed invoice amount');
    return { subtotal, taxAmount, discountAmount: this.money(discountAmount), totalAmount };
  }
  private itemData(items: InvoiceItemDto[]) {
    return items.map((item) => ({ ...item, taxRate: item.taxRate ?? 0, lineTotal: this.money(item.quantity * item.unitPrice) }));
  }
  private money(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
}
