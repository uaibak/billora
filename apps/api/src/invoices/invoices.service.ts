import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditEntityType, InvoiceStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { BusinessesService } from '../businesses/businesses.service';
import { getPagination, paginate } from '../common/dto/pagination.dto';
import { JOB_NAMES } from '../jobs/jobs.constants';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceDocumentsService } from './invoice-documents.service';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import { CreateInvoiceDto, InvoiceItemDto, UpdateInvoiceDto } from './dto/invoice.dto';

const invoiceInclude = { customer: true, business: true, items: true, payments: true } as const;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    public readonly businesses: BusinessesService,
    private readonly audit: AuditService,
    private readonly jobs: JobsService,
    private readonly documents: InvoiceDocumentsService,
  ) {}

  async create(userId: string, dto: CreateInvoiceDto) {
    const business = await this.businesses.findOwned(userId, dto.businessId);
    await this.businesses.organizations.requireWritable(userId, business.organizationId);
    await this.ensureCustomer(dto.customerId, dto.businessId);
    this.validateDates(dto.issueDate, dto.dueDate);
    const totals = this.calculate(dto.items, dto.discountAmount);

    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.invoice.findFirst({ where: { invoiceNumber: { startsWith: `BIL-${new Date(dto.issueDate).getUTCFullYear()}-` } }, orderBy: { invoiceNumber: 'desc' }, select: { invoiceNumber: true } });
      const sequence = latest ? Number(latest.invoiceNumber.split('-').at(-1)) + 1 : 1;
      const invoiceNumber = `BIL-${new Date(dto.issueDate).getUTCFullYear()}-${String(sequence).padStart(6, '0')}`;
      const invoice = await tx.invoice.create({
        data: {
          businessId: dto.businessId, customerId: dto.customerId, invoiceNumber,
          issueDate: new Date(dto.issueDate), dueDate: new Date(dto.dueDate), notes: dto.notes,
          ...totals,
          items: { create: this.itemData(dto.items) },
        }, include: invoiceInclude,
      });
      await this.audit.record({ organizationId: business.organizationId, userId, action: AuditAction.INVOICE_CREATED, entityType: AuditEntityType.INVOICE, entityId: invoice.id, metadata: { invoiceNumber, totalAmount: totals.totalAmount } }, tx);
      return invoice;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async findAll(userId: string, query: InvoiceQueryDto) {
    const { search, organizationId, businessId, customerId, status } = query;
    const { page, limit } = getPagination(query);
    const where: Prisma.InvoiceWhereInput = {
      ...(businessId ? { businessId } : {}),
      ...(customerId ? { customerId } : {}),
      ...(status ? { status } : {}),
      business: { organization: { members: { some: { userId } }, ...(organizationId ? { id: organizationId } : {}) } },
      ...(search ? { OR: [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { email: { contains: search, mode: 'insensitive' } } },
      ] } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: invoiceInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }
  async findOwned(userId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, business: { organization: { members: { some: { userId } } } } }, include: invoiceInclude });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }
  findOne(userId: string, id: string) { return this.findOwned(userId, id); }

  async update(userId: string, id: string, dto: UpdateInvoiceDto) {
    const invoice = await this.findOwned(userId, id);
    await this.businesses.organizations.requireWritable(userId, invoice.business.organizationId);
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
      const updated = await tx.invoice.update({ where: { id }, data: {
        ...fields, issueDate: new Date(issueDate), dueDate: new Date(dueDate), ...totals,
        pdfStatus: 'NOT_GENERATED', pdfPath: null, pdfGeneratedAt: null,
        ...(items ? { items: { create: this.itemData(items) } } : {}),
      }, include: invoiceInclude });
      await this.audit.record({ organizationId: invoice.business.organizationId, userId, action: AuditAction.INVOICE_UPDATED, entityType: AuditEntityType.INVOICE, entityId: id, metadata: { changes: { ...dto }, totals } }, tx);
      return updated;
    });
  }

  async remove(userId: string, id: string) {
    const invoice = await this.findOwned(userId, id);
    await this.businesses.organizations.requireWritable(userId, invoice.business.organizationId);
    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.delete({ where: { id } });
      await this.audit.record({ organizationId: invoice.business.organizationId, userId, action: AuditAction.INVOICE_DELETED, entityType: AuditEntityType.INVOICE, entityId: id, metadata: { invoiceNumber: invoice.invoiceNumber } }, tx);
    });
    return { message: 'Invoice deleted' };
  }
  async send(userId: string, id: string) {
    const invoice = await this.findOwned(userId, id);
    await this.businesses.organizations.requireWritable(userId, invoice.business.organizationId);
    if (invoice.status !== InvoiceStatus.DRAFT) throw new BadRequestException('Only draft invoices can be sent');
    const updated = await this.prisma.$transaction(async (tx) => {
      const sent = await tx.invoice.update({ where: { id }, data: { status: InvoiceStatus.SENT } });
      await this.audit.record({ organizationId: invoice.business.organizationId, userId, action: AuditAction.INVOICE_SENT, entityType: AuditEntityType.INVOICE, entityId: id, metadata: { invoiceNumber: invoice.invoiceNumber } }, tx);
      return sent;
    });
    const job = await this.jobs.add('email', JOB_NAMES.sendInvoiceEmail, {
      organizationId: invoice.business.organizationId,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      customerEmail: invoice.customer.email,
      businessId: invoice.businessId,
      requestedByUserId: userId,
    });
    await this.prisma.invoice.update({ where: { id }, data: { emailStatus: job.queued ? 'QUEUED' : 'NOT_SENT' } });
    if (job.queued) {
      await this.audit.record({ organizationId: invoice.business.organizationId, userId, action: AuditAction.INVOICE_EMAIL_QUEUED, entityType: AuditEntityType.INVOICE, entityId: id, metadata: { invoiceNumber: invoice.invoiceNumber, jobId: job.jobId } });
    }
    return { message: job.queued ? 'Invoice marked as sent and email job queued' : 'Invoice marked as sent; email job was not queued', invoice: updated, job };
  }

  async requestPdf(userId: string, id: string) {
    const invoice = await this.findOwned(userId, id);
    await this.businesses.organizations.requireWritable(userId, invoice.business.organizationId);
    await this.prisma.invoice.update({ where: { id }, data: { pdfStatus: 'QUEUED' } });
    const job = await this.jobs.add('pdf', JOB_NAMES.generateInvoicePdf, {
      organizationId: invoice.business.organizationId,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      requestedByUserId: userId,
    });
    await this.audit.record({ organizationId: invoice.business.organizationId, userId, action: AuditAction.INVOICE_PDF_QUEUED, entityType: AuditEntityType.INVOICE, entityId: id, metadata: { invoiceNumber: invoice.invoiceNumber, jobId: job.jobId, queued: job.queued } });
    const generated = job.queued ? null : await this.documents.generate(id);
    return { message: job.queued ? 'Invoice PDF generation queued' : 'Invoice PDF generated locally', job, invoice: generated };
  }

  async downloadPdf(userId: string, id: string) {
    await this.findOwned(userId, id);
    await this.documents.generate(id);
    const file = await this.documents.read(id);
    if (!file) throw new NotFoundException('Invoice PDF not found');
    return file;
  }
  async markPaid(userId: string, id: string) {
    const invoice = await this.findOwned(userId, id);
    await this.businesses.organizations.requireWritable(userId, invoice.business.organizationId);
    return this.prisma.$transaction(async (tx) => {
      const paid = await tx.invoice.update({ where: { id }, data: { status: InvoiceStatus.PAID, pdfStatus: 'NOT_GENERATED', pdfPath: null, pdfGeneratedAt: null }, include: invoiceInclude });
      await this.audit.record({ organizationId: invoice.business.organizationId, userId, action: AuditAction.INVOICE_MARKED_PAID, entityType: AuditEntityType.INVOICE, entityId: id, metadata: { invoiceNumber: invoice.invoiceNumber } }, tx);
      return paid;
    });
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
