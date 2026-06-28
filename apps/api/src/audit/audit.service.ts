import { Injectable } from '@nestjs/common';
import { AuditAction, AuditEntityType, Prisma } from '@prisma/client';
import { getPagination, paginate } from '../common/dto/pagination.dto';
import { OrganizationsService } from '../organizations/organizations.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditQueryDto } from './dto/audit-query.dto';

type AuditInput = {
  organizationId: string;
  userId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  metadata?: unknown;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService, private readonly organizations: OrganizationsService) {}

  record(input: AuditInput, tx: Prisma.TransactionClient | PrismaService = this.prisma) {
    return tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata === undefined ? undefined : this.toJson(input.metadata),
      },
    });
  }

  async findAll(userId: string, query: AuditQueryDto) {
    await this.organizations.findMember(userId, query.organizationId);
    const { organizationId, action, entityType, entityId, search, dateFrom, dateTo } = query;
    const { page, limit } = getPagination(query);
    const where: Prisma.AuditLogWhereInput = {
      organizationId,
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...((dateFrom || dateTo) ? { createdAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } } : {}),
      ...(search ? { OR: [
        { entityId: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { fullName: { contains: search, mode: 'insensitive' } } },
      ] } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, email: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }

  async exportCsv(userId: string, query: AuditQueryDto) {
    await this.organizations.findMember(userId, query.organizationId);
    const { organizationId, action, entityType, entityId, search, dateFrom, dateTo } = query;
    const where: Prisma.AuditLogWhereInput = {
      organizationId,
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...((dateFrom || dateTo) ? { createdAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } } : {}),
      ...(search ? { OR: [
        { entityId: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { fullName: { contains: search, mode: 'insensitive' } } },
      ] } : {}),
    };
    const rows = await this.prisma.auditLog.findMany({
      where,
      include: { user: { select: { email: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    return [
      ['createdAt', 'action', 'entityType', 'entityId', 'user', 'metadata'].join(','),
      ...rows.map((row) => [row.createdAt.toISOString(), row.action, row.entityType, row.entityId, row.user?.email ?? '', JSON.stringify(row.metadata ?? {})].map(csvCell).join(',')),
    ].join('\n');
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
