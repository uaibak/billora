import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
@Module({ imports: [BusinessesModule, AuditModule], controllers: [CustomersController], providers: [CustomersService] })
export class CustomersModule {}
