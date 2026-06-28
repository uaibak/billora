import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
@Module({ imports: [InvoicesModule, AuditModule], controllers: [PaymentsController], providers: [PaymentsService] })
export class PaymentsModule {}
