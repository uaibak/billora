import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}
  create(userId: string, dto: CreateBusinessDto) { return this.prisma.business.create({ data: { ...dto, userId } }); }
  findAll(userId: string) { return this.prisma.business.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }); }
  async findOwned(userId: string, id: string) {
    const business = await this.prisma.business.findFirst({ where: { id, userId } });
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }
  findOne(userId: string, id: string) { return this.findOwned(userId, id); }
  async update(userId: string, id: string, dto: UpdateBusinessDto) {
    await this.findOwned(userId, id);
    return this.prisma.business.update({ where: { id }, data: dto });
  }
  async remove(userId: string, id: string) {
    await this.findOwned(userId, id);
    await this.prisma.business.delete({ where: { id } });
    return { message: 'Business deleted' };
  }
}
