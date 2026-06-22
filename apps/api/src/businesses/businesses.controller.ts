import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';

@Controller('businesses')
export class BusinessesController {
  constructor(private readonly service: BusinessesService) {}
  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: CreateBusinessDto) { return this.service.create(u.id, dto); }
  @Get() all(@CurrentUser() u: AuthUser) { return this.service.findAll(u.id); }
  @Get(':id') one(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.findOne(u.id, id); }
  @Put(':id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateBusinessDto) { return this.service.update(u.id, id, dto); }
  @Delete(':id') remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.remove(u.id, id); }
}
