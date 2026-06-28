import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditEntityType, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { BusinessesService } from '../businesses/businesses.service';
import { getPagination, paginate, PaginationQueryDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService, private readonly businesses: BusinessesService, private readonly audit: AuditService) {}
  async create(userId: string, dto: CreateCustomerDto) {
    const business = await this.businesses.findOwned(userId, dto.businessId);
    await this.businesses.organizations.requireWritable(userId, business.organizationId);
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({ data: dto });
      await this.audit.record({ organizationId: business.organizationId, userId, action: AuditAction.CUSTOMER_CREATED, entityType: AuditEntityType.CUSTOMER, entityId: customer.id, metadata: { name: customer.name, businessId: dto.businessId } }, tx);
      return customer;
    });
  }
  async findAll(userId: string, query: PaginationQueryDto) {
    const { search, organizationId, businessId } = query;
    const { page, limit } = getPagination(query);
    const where: Prisma.CustomerWhereInput = {
      ...(businessId ? { businessId } : {}),
      business: { organization: { members: { some: { userId } }, ...(organizationId ? { id: organizationId } : {}) } },
      ...(search ? { OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { country: { contains: search, mode: 'insensitive' } },
      ] } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        include: { business: { select: { id: true, name: true, organizationId: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }
  async findOwned(userId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, business: { organization: { members: { some: { userId } } } } } });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }
  findOne(userId: string, id: string) { return this.findOwned(userId, id); }
  async update(userId: string, id: string, dto: UpdateCustomerDto) {
    const customer = await this.findOwned(userId, id);
    const business = await this.businesses.findOwned(userId, customer.businessId);
    await this.businesses.organizations.requireWritable(userId, business.organizationId);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({ where: { id }, data: dto });
      await this.audit.record({ organizationId: business.organizationId, userId, action: AuditAction.CUSTOMER_UPDATED, entityType: AuditEntityType.CUSTOMER, entityId: id, metadata: { changes: { ...dto } } }, tx);
      return updated;
    });
  }
  async remove(userId: string, id: string) {
    const customer = await this.findOwned(userId, id);
    const business = await this.businesses.findOwned(userId, customer.businessId);
    await this.businesses.organizations.requireWritable(userId, business.organizationId);
    await this.prisma.$transaction(async (tx) => {
      await tx.customer.delete({ where: { id } });
      await this.audit.record({ organizationId: business.organizationId, userId, action: AuditAction.CUSTOMER_DELETED, entityType: AuditEntityType.CUSTOMER, entityId: id, metadata: { name: customer.name, businessId: customer.businessId } }, tx);
    });
    return { message: 'Customer deleted' };
  }
}
