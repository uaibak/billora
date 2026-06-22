import { Injectable, NotFoundException } from '@nestjs/common';
import { BusinessesService } from '../businesses/businesses.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService, private readonly businesses: BusinessesService) {}
  async create(userId: string, dto: CreateCustomerDto) {
    await this.businesses.findOwned(userId, dto.businessId);
    return this.prisma.customer.create({ data: dto });
  }
  findAll(userId: string) {
    return this.prisma.customer.findMany({ where: { business: { userId } }, include: { business: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } });
  }
  async findOwned(userId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, business: { userId } } });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }
  findOne(userId: string, id: string) { return this.findOwned(userId, id); }
  async update(userId: string, id: string, dto: UpdateCustomerDto) {
    await this.findOwned(userId, id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }
  async remove(userId: string, id: string) {
    await this.findOwned(userId, id);
    await this.prisma.customer.delete({ where: { id } });
    return { message: 'Customer deleted' };
  }
}
