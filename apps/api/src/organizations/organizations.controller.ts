import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AcceptInviteDto, CreateInviteDto } from './dto/invite.dto';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Post() create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrganizationDto) { return this.service.create(user.id, dto); }
  @Get() all(@CurrentUser() user: AuthUser) { return this.service.findAll(user.id); }
  @Put(':id') update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateOrganizationDto) { return this.service.update(user.id, id, dto); }
  @Get(':id/members') members(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.members(user.id, id); }
  @Post(':id/invites') createInvite(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateInviteDto) { return this.service.createInvite(user.id, id, dto); }
  @Get(':id/invites') invites(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.service.invites(user.id, id); }
  @Post(':id/invites/:inviteId/resend') resendInvite(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('inviteId') inviteId: string) { return this.service.resendInvite(user.id, id, inviteId); }
  @Delete(':id/invites/:inviteId') cancelInvite(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('inviteId') inviteId: string) { return this.service.cancelInvite(user.id, id, inviteId); }
  @Post('invites/accept') acceptInvite(@CurrentUser() user: AuthUser, @Body() dto: AcceptInviteDto) { return this.service.acceptInvite(user.id, dto.token); }
}
