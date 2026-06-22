import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}
  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: CreateCustomerDto) { return this.service.create(u.id, dto); }
  @Get() all(@CurrentUser() u: AuthUser) { return this.service.findAll(u.id); }
  @Get(':id') one(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.findOne(u.id, id); }
  @Put(':id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateCustomerDto) { return this.service.update(u.id, id, dto); }
  @Delete(':id') remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.remove(u.id, id); }
}
