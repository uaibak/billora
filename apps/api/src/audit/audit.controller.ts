import { Controller, Get, Header, Query } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get() all(@CurrentUser() user: AuthUser, @Query() query: AuditQueryDto) {
    return this.audit.findAll(user.id, query);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="billora-audit-logs.csv"')
  export(@CurrentUser() user: AuthUser, @Query() query: AuditQueryDto) {
    return this.audit.exportCsv(user.id, query);
  }
}
