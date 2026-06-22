import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
export class ManualPaymentDto {
  @IsUUID() invoiceId: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount: number;
  @IsOptional() @IsString() providerReference?: string;
}
