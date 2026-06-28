import { Module } from '@nestjs/common';
import { OrganizationPolicyService } from './organization-policy.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationPolicyService],
  exports: [OrganizationsService, OrganizationPolicyService],
})
export class OrganizationsModule {}
