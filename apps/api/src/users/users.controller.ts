import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('me') async me(@CurrentUser() auth: AuthUser) {
    const user = await this.prisma.user.findUnique({ where: { id: auth.id }, omit: { passwordHash: true } });
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
