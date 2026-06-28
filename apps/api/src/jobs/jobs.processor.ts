import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { AuditAction, AuditEntityType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { InvoiceDocumentsService } from '../invoices/invoice-documents.service';
import { InvoiceMailerService } from '../invoices/invoice-mailer.service';
import { JOB_NAMES, QUEUE_NAMES } from './jobs.constants';
import { JobsService } from './jobs.service';

@Injectable()
export class JobsProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsProcessor.name);
  private workers: Worker[] = [];

  constructor(
    private readonly config: ConfigService,
    private readonly jobs: JobsService,
    private readonly documents: InvoiceDocumentsService,
    private readonly mailer: InvoiceMailerService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (!redisUrl) return;
    const connection = this.jobs.connectionOptions(redisUrl);
    this.workers = [
      new Worker(QUEUE_NAMES.pdf, (job) => this.handlePdf(job), { connection }),
      new Worker(QUEUE_NAMES.email, (job) => this.handleEmail(job), { connection }),
    ];
    this.workers.forEach((worker) => worker.on('failed', (job, error) => this.logger.warn(`Job ${job?.name} failed: ${error.message}`)));
  }

  async onModuleDestroy() {
    await Promise.all(this.workers.map((worker) => worker.close()));
  }

  private async handlePdf(job: Job) {
    if (job.name !== JOB_NAMES.generateInvoicePdf) return;
    const invoice = await this.documents.generate(String(job.data.invoiceId));
    await this.audit.record({
      organizationId: invoice.business.organizationId,
      userId: String(job.data.requestedByUserId),
      action: AuditAction.INVOICE_PDF_GENERATED,
      entityType: AuditEntityType.INVOICE,
      entityId: invoice.id,
      metadata: { invoiceNumber: invoice.invoiceNumber, pdfPath: invoice.pdfPath },
    });
  }

  private async handleEmail(job: Job) {
    if (job.name !== JOB_NAMES.sendInvoiceEmail) return;
    try {
      const invoice = await this.mailer.send(String(job.data.invoiceId));
      await this.audit.record({
        organizationId: invoice.business.organizationId,
        userId: String(job.data.requestedByUserId),
        action: AuditAction.INVOICE_EMAIL_SENT,
        entityType: AuditEntityType.INVOICE,
        entityId: invoice.id,
        metadata: { invoiceNumber: invoice.invoiceNumber },
      });
    } catch (error) {
      const invoice = await this.mailer.markFailed(String(job.data.invoiceId), error);
      await this.audit.record({
        organizationId: String(job.data.organizationId ?? invoice.business.organizationId),
        userId: String(job.data.requestedByUserId),
        action: AuditAction.INVOICE_EMAIL_FAILED,
        entityType: AuditEntityType.INVOICE,
        entityId: invoice.id,
        metadata: { invoiceNumber: invoice.invoiceNumber, error: error instanceof Error ? error.message : 'Email delivery failed' },
      });
      throw error;
    }
  }
}
