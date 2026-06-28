import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditEntityType, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { AuditService } from '../audit/audit.service';
import { getPagination, paginate, PaginationQueryDto } from '../common/dto/pagination.dto';
import { OrganizationsService } from '../organizations/organizations.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService, public readonly organizations: OrganizationsService, private readonly audit: AuditService, private readonly config: ConfigService) {}

  async create(userId: string, dto: CreateBusinessDto) {
    const { organizationId = await this.organizations.defaultOrganizationId(userId), ...data } = dto;
    await this.organizations.requireWritable(userId, organizationId);
    return this.prisma.$transaction(async (tx) => {
      const business = await tx.business.create({ data: { ...data, organizationId } });
      await this.audit.record({ organizationId, userId, action: AuditAction.BUSINESS_CREATED, entityType: AuditEntityType.BUSINESS, entityId: business.id, metadata: { name: business.name } }, tx);
      return business;
    });
  }

  async findAll(userId: string, query: PaginationQueryDto) {
    const { search, organizationId } = query;
    const { page, limit } = getPagination(query);
    const where: Prisma.BusinessWhereInput = {
      organization: { members: { some: { userId } } },
      ...(organizationId ? { organizationId } : {}),
      ...(search ? { OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { country: { contains: search, mode: 'insensitive' } },
        { taxNumber: { contains: search, mode: 'insensitive' } },
      ] } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.business.findMany({
        where,
        include: { organization: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.business.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }

  async findOwned(userId: string, id: string) {
    const business = await this.prisma.business.findFirst({
      where: { id, organization: { members: { some: { userId } } } },
      include: { organization: { select: { id: true, name: true, slug: true } } },
    });
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  findOne(userId: string, id: string) { return this.findOwned(userId, id); }

  async update(userId: string, id: string, dto: UpdateBusinessDto) {
    const business = await this.findOwned(userId, id);
    await this.organizations.requireWritable(userId, business.organizationId);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.business.update({ where: { id }, data: dto });
      await this.audit.record({ organizationId: business.organizationId, userId, action: AuditAction.BUSINESS_UPDATED, entityType: AuditEntityType.BUSINESS, entityId: id, metadata: { changes: { ...dto } } }, tx);
      return updated;
    });
  }

  async remove(userId: string, id: string) {
    const business = await this.findOwned(userId, id);
    await this.organizations.requireWritable(userId, business.organizationId);
    await this.prisma.$transaction(async (tx) => {
      await tx.business.delete({ where: { id } });
      await this.audit.record({ organizationId: business.organizationId, userId, action: AuditAction.BUSINESS_DELETED, entityType: AuditEntityType.BUSINESS, entityId: id, metadata: { name: business.name } }, tx);
    });
    return { message: 'Business deleted' };
  }

  async uploadLogo(userId: string, id: string, file?: { buffer: Buffer; originalname: string; mimetype: string; size: number }) {
    const business = await this.findOwned(userId, id);
    await this.organizations.requireWritable(userId, business.organizationId);
    if (!file) throw new BadRequestException('Logo file is required');
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.mimetype)) throw new BadRequestException('Logo must be PNG, JPG, WEBP, or SVG');
    if (file.size > 1024 * 1024 * 2) throw new BadRequestException('Logo must be 2MB or smaller');
    const safeExt = extname(file.originalname).toLowerCase() || mimeExt(file.mimetype);
    const fileName = `${id}-${Date.now()}${safeExt}`;
    const outputDir = join(process.cwd(), this.config.get<string>('LOGO_STORAGE_DIR') ?? 'storage/logos');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(join(outputDir, fileName), file.buffer);
    const logoUrl = `/uploads/logos/${fileName}`;
    return this.update(userId, id, { logoUrl });
  }
}

function mimeExt(mime: string) {
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/svg+xml') return '.svg';
  return '.png';
}
