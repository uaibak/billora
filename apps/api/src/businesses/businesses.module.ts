import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';

@Module({ imports: [OrganizationsModule, AuditModule], controllers: [BusinessesController], providers: [BusinessesService], exports: [BusinessesService] })
export class BusinessesModule {}
