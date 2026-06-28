import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceDocumentsService } from './invoice-documents.service';

@Injectable()
export class InvoiceMailerService {
  private readonly logger = new Logger(InvoiceMailerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: InvoiceDocumentsService,
    private readonly config: ConfigService,
  ) {}

  async send(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { customer: true, business: true } });
    if (!invoice.customer.email) throw new Error('Customer email is missing');
    if (invoice.pdfStatus !== 'GENERATED') await this.documents.generate(invoiceId);
    const publicUrl = `${this.config.get<string>('WEB_APP_URL') ?? 'http://localhost:3000'}/invoices/public/${invoice.publicToken}`;

    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      this.logger.warn(`SMTP_HOST is not configured. Simulating invoice email for ${invoice.invoiceNumber}.`);
      return this.markSent(invoiceId);
    }

    const transporter = nodemailer.createTransport({
      host,
      port: Number(this.config.get<string>('SMTP_PORT') ?? 587),
      secure: this.config.get<string>('SMTP_SECURE') === 'true',
      auth: this.config.get<string>('SMTP_USER') ? {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      } : undefined,
    });

    await transporter.sendMail({
      from: this.config.get<string>('MAIL_FROM') ?? 'billing@billora.app',
      to: invoice.customer.email,
      subject: `Invoice ${invoice.invoiceNumber} from ${invoice.business.name}`,
      text: `Your invoice is ready: ${publicUrl}`,
    });
    return this.markSent(invoiceId);
  }

  async markFailed(invoiceId: string, error: unknown) {
    const message = error instanceof Error ? error.message : 'Email delivery failed';
    return this.prisma.invoice.update({ where: { id: invoiceId }, data: { emailStatus: 'FAILED', lastEmailError: message }, include: { business: true } });
  }

  private markSent(invoiceId: string) {
    return this.prisma.invoice.update({ where: { id: invoiceId }, data: { emailStatus: 'SENT', emailedAt: new Date(), lastEmailError: null }, include: { business: true } });
  }
}
