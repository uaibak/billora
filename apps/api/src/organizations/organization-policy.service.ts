import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationMemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const writeRoles: OrganizationMemberRole[] = [OrganizationMemberRole.OWNER, OrganizationMemberRole.ADMIN];

@Injectable()
export class OrganizationPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async member(userId: string, organizationId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      include: { organization: true },
    });
    if (!member) throw new NotFoundException('Organization not found');
    return member;
  }

  async requireWritable(userId: string, organizationId: string) {
    const member = await this.member(userId, organizationId);
    if (!writeRoles.includes(member.role)) throw new ForbiddenException('You do not have permission to manage this organization');
    return member;
  }

  async requireOwner(userId: string, organizationId: string) {
    const member = await this.member(userId, organizationId);
    if (member.role !== OrganizationMemberRole.OWNER) throw new ForbiddenException('Only organization owners can perform this action');
    return member;
  }

  canWrite(role?: OrganizationMemberRole | string) {
    return role === OrganizationMemberRole.OWNER || role === OrganizationMemberRole.ADMIN;
  }
}
