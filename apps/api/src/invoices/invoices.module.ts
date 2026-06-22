import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
@Module({ imports: [BusinessesModule], controllers: [InvoicesController], providers: [InvoicesService], exports: [InvoicesService] })
export class InvoicesModule {}
