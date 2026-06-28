import { Body, Controller, Delete, Get, Header, Param, Post, Put, Query, StreamableFile } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto/invoice.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}
  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: CreateInvoiceDto) { return this.service.create(u.id, dto); }
  @Get() all(@CurrentUser() u: AuthUser, @Query() query: InvoiceQueryDto) { return this.service.findAll(u.id, query); }
  @Post(':id/pdf') generatePdf(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.requestPdf(u.id, id); }
  @Get(':id/pdf') @Header('Content-Type', 'text/html') async downloadPdf(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return new StreamableFile(await this.service.downloadPdf(u.id, id));
  }
  @Get(':id') one(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.findOne(u.id, id); }
  @Put(':id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateInvoiceDto) { return this.service.update(u.id, id, dto); }
  @Delete(':id') remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.remove(u.id, id); }
  @Post(':id/send') send(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.send(u.id, id); }
  @Post(':id/mark-paid') paid(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.service.markPaid(u.id, id); }
}
