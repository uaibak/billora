import { IsEmail, IsOptional, IsString, IsUrl, IsUUID, MinLength } from 'class-validator';

export class CreateBusinessDto {
  @IsOptional() @IsUUID() organizationId?: string;
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() taxNumber?: string;
  @IsOptional() @IsUrl() logoUrl?: string;
}

export class UpdateBusinessDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() taxNumber?: string;
  @IsOptional() @IsUrl() logoUrl?: string;
}
