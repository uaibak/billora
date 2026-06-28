import { AuditAction, AuditEntityType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class AuditQueryDto extends PaginationQueryDto {
  @IsUUID() declare organizationId: string;
  @IsOptional() @IsEnum(AuditAction) action?: AuditAction;
  @IsOptional() @IsEnum(AuditEntityType) entityType?: AuditEntityType;
  @IsOptional() @IsString() entityId?: string;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
}
