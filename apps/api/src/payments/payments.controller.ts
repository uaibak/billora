import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ManualPaymentDto } from './dto/manual-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}
  @Post('manual') manual(@CurrentUser() u: AuthUser, @Body() dto: ManualPaymentDto) { return this.service.manual(u.id, dto); }
  @Get('invoice/:invoiceId') byInvoice(@CurrentUser() u: AuthUser, @Param('invoiceId') id: string) { return this.service.forInvoice(u.id, id); }
}
