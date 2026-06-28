import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { JobsModule } from '../jobs/jobs.module';
import { JobsProcessor } from '../jobs/jobs.processor';
import { InvoiceDocumentsService } from './invoice-documents.service';
import { InvoiceMailerService } from './invoice-mailer.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
@Module({
  imports: [BusinessesModule, AuditModule, JobsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoiceDocumentsService, InvoiceMailerService, JobsProcessor],
  exports: [InvoicesService],
})
export class InvoicesModule {}
