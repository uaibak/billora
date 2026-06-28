import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class PaymentQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(PaymentStatus) status?: PaymentStatus;
  @IsOptional() @IsEnum(PaymentProvider) provider?: PaymentProvider;
}
