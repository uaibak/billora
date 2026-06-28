import { Body, Controller, Delete, Get, Param, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';

@Controller('businesses')
export class BusinessesController {
  constructor(private readonly service: BusinessesService) {}
  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: CreateBusinessDto) { return this.service.create(u.id, dto); }
  @Get() all(@CurrentUser() u: AuthUser, @Query() query: PaginationQueryDto) { return this.service.findAll(u.id, query); }
  @Get(':id') one(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.findOne(u.id, id); }
  @Put(':id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateBusinessDto) { return this.service.update(u.id, id, dto); }
  @Post(':id/logo') @UseInterceptors(FileInterceptor('logo')) uploadLogo(@CurrentUser() u: AuthUser, @Param('id') id: string, @UploadedFile() file: any) { return this.service.uploadLogo(u.id, id, file); }
  @Delete(':id') remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.remove(u.id, id); }
}
