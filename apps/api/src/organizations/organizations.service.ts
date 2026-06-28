import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditEntityType, OrganizationInviteStatus, OrganizationMemberRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInviteDto } from './dto/invite.dto';
import { OrganizationPolicyService } from './organization-policy.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService, private readonly policy: OrganizationPolicyService) {}

  async create(userId: string, dto: CreateOrganizationDto) {
    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          ownerId: userId,
          name: dto.name,
          slug: await this.uniqueSlug(dto.name),
          members: { create: { userId, role: OrganizationMemberRole.OWNER } },
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          userId,
          action: AuditAction.ORGANIZATION_CREATED,
          entityType: AuditEntityType.ORGANIZATION,
          entityId: organization.id,
          metadata: { name: organization.name },
        },
      });
      return organization;
    });
  }

  findAll(userId: string) {
    return this.prisma.organization.findMany({
      where: { members: { some: { userId } } },
      include: { members: { select: { userId: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMember(userId: string, organizationId: string) {
    return this.policy.member(userId, organizationId);
  }

  async requireWritable(userId: string, organizationId: string) {
    return this.policy.requireWritable(userId, organizationId);
  }

  async requireOwner(userId: string, organizationId: string) {
    return this.policy.requireOwner(userId, organizationId);
  }

  async defaultOrganizationId(userId: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { organizationId: true },
    });
    if (member) return member.organizationId;
    const organization = await this.create(userId, { name: 'My Organization' });
    return organization.id;
  }

  async update(userId: string, id: string, dto: UpdateOrganizationDto) {
    await this.requireWritable(userId, id);
    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.update({
        where: { id },
        data: { ...dto, ...(dto.name ? { slug: await this.uniqueSlug(dto.name, id) } : {}) },
      });
      await tx.auditLog.create({
        data: {
          organizationId: id,
          userId,
          action: AuditAction.ORGANIZATION_UPDATED,
          entityType: AuditEntityType.ORGANIZATION,
          entityId: id,
          metadata: { changes: { ...dto } },
        },
      });
      return organization;
    });
  }

  async members(userId: string, id: string) {
    await this.findMember(userId, id);
    return this.prisma.organizationMember.findMany({
      where: { organizationId: id },
      include: { user: { select: { id: true, email: true, fullName: true, role: true, createdAt: true, updatedAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createInvite(userId: string, organizationId: string, dto: CreateInviteDto) {
    await this.requireWritable(userId, organizationId);
    const email = dto.email.trim().toLowerCase();
    const role = dto.role ?? OrganizationMemberRole.MEMBER;
    if (role === OrganizationMemberRole.OWNER) throw new BadRequestException('Owner role cannot be invited');

    const existingUser = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser && await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: existingUser.id } } })) {
      throw new ConflictException('User is already a member of this organization');
    }

    const existingInvite = await this.prisma.organizationInvite.findFirst({ where: { organizationId, email, status: OrganizationInviteStatus.PENDING } });
    if (existingInvite) throw new ConflictException('A pending invite already exists for this email');

    const invite = await this.prisma.organizationInvite.create({
      data: {
        organizationId,
        email,
        role,
        token: randomBytes(32).toString('hex'),
        invitedById: userId,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
      include: { invitedBy: { select: { id: true, email: true, fullName: true } } },
    });
    await this.prisma.auditLog.create({
      data: { organizationId, userId, action: AuditAction.ORGANIZATION_INVITE_CREATED, entityType: AuditEntityType.ORGANIZATION, entityId: organizationId, metadata: { email, role } },
    });
    return invite;
  }

  async invites(userId: string, organizationId: string) {
    await this.requireWritable(userId, organizationId);
    return this.prisma.organizationInvite.findMany({
      where: { organizationId },
      include: {
        invitedBy: { select: { id: true, email: true, fullName: true } },
        acceptedBy: { select: { id: true, email: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancelInvite(userId: string, organizationId: string, inviteId: string) {
    await this.requireWritable(userId, organizationId);
    const invite = await this.prisma.organizationInvite.findFirst({ where: { id: inviteId, organizationId } });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.status !== OrganizationInviteStatus.PENDING) throw new BadRequestException('Only pending invites can be cancelled');
    const updated = await this.prisma.organizationInvite.update({
      where: { id: inviteId },
      data: { status: OrganizationInviteStatus.CANCELLED, cancelledAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: { organizationId, userId, action: AuditAction.ORGANIZATION_INVITE_CANCELLED, entityType: AuditEntityType.ORGANIZATION, entityId: organizationId, metadata: { email: invite.email } },
    });
    return updated;
  }

  async resendInvite(userId: string, organizationId: string, inviteId: string) {
    await this.requireWritable(userId, organizationId);
    const invite = await this.prisma.organizationInvite.findFirst({ where: { id: inviteId, organizationId } });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.status !== OrganizationInviteStatus.PENDING) throw new BadRequestException('Only pending invites can be resent');
    const updated = await this.prisma.organizationInvite.update({
      where: { id: inviteId },
      data: {
        token: randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
      include: { invitedBy: { select: { id: true, email: true, fullName: true } } },
    });
    await this.prisma.auditLog.create({
      data: { organizationId, userId, action: AuditAction.ORGANIZATION_INVITE_RESENT, entityType: AuditEntityType.ORGANIZATION, entityId: organizationId, metadata: { email: invite.email } },
    });
    return updated;
  }

  async acceptInvite(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) throw new NotFoundException('User not found');
    const invite = await this.prisma.organizationInvite.findUnique({ where: { token } });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.status !== OrganizationInviteStatus.PENDING) throw new BadRequestException('Invite is no longer pending');
    if (invite.expiresAt < new Date()) {
      await this.prisma.organizationInvite.update({ where: { id: invite.id }, data: { status: OrganizationInviteStatus.EXPIRED } });
      throw new BadRequestException('Invite has expired');
    }
    if (invite.email.toLowerCase() !== user.email.toLowerCase()) throw new ForbiddenException('This invite belongs to another email address');

    return this.prisma.$transaction(async (tx) => {
      await tx.organizationMember.upsert({
        where: { organizationId_userId: { organizationId: invite.organizationId, userId } },
        create: { organizationId: invite.organizationId, userId, role: invite.role },
        update: { role: invite.role },
      });
      const accepted = await tx.organizationInvite.update({
        where: { id: invite.id },
        data: { status: OrganizationInviteStatus.ACCEPTED, acceptedById: userId, acceptedAt: new Date() },
        include: { organization: true },
      });
      await tx.auditLog.create({
        data: { organizationId: invite.organizationId, userId, action: AuditAction.ORGANIZATION_INVITE_ACCEPTED, entityType: AuditEntityType.ORGANIZATION, entityId: invite.organizationId, metadata: { email: invite.email, role: invite.role } },
      });
      return accepted;
    });
  }

  private async uniqueSlug(name: string, excludeId?: string) {
    const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'organization';
    let slug = base;
    let suffix = 1;
    while (await this.prisma.organization.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) } })) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }
    return slug;
  }
}
