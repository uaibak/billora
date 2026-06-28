import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @IsString() @MinLength(2) name: string;
}

export class UpdateOrganizationDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
}
