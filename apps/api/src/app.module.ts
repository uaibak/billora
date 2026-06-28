import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BusinessesModule } from './businesses/businesses.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { InvoicesModule } from './invoices/invoices.module';
import { JobsModule } from './jobs/jobs.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { SystemModule } from './system/system.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), PrismaModule, SystemModule, AuthModule, UsersModule,
    OrganizationsModule, AuditModule, JobsModule, DashboardModule, BusinessesModule, CustomersModule, InvoicesModule, PaymentsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: RateLimitGuard }, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
