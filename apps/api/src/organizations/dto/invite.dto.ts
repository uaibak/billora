import { OrganizationMemberRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateInviteDto {
  @IsEmail() email: string;
  @IsOptional() @IsEnum(OrganizationMemberRole) role?: OrganizationMemberRole;
}

export class AcceptInviteDto {
  @IsString() @MinLength(16) token: string;
}

export class InviteParamsDto {
  @IsUUID() organizationId: string;
  @IsUUID() inviteId: string;
}
