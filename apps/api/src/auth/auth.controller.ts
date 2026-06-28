import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { AuthUser } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const ACCESS_TOKEN_COOKIE = 'billora_access_token';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.register(dto);
    this.setAuthCookie(response, result.accessToken);
    return result;
  }

  @Public() @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(dto);
    this.setAuthCookie(response, result.accessToken);
    return result;
  }

  @Public() @HttpCode(200) @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    return { message: 'Logged out' };
  }

  @Get('me') me(@CurrentUser() user: AuthUser) { return this.auth.me(user.id); }

  private setAuthCookie(response: Response, token: string) {
    response.cookie(ACCESS_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: this.cookieMaxAge(),
    });
  }

  private cookieMaxAge() {
    const value = process.env.JWT_EXPIRES_IN ?? '7d';
    const match = /^(\d+)([dhm])$/.exec(value);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const amount = Number(match[1]);
    const unit = match[2];
    if (unit === 'd') return amount * 24 * 60 * 60 * 1000;
    if (unit === 'h') return amount * 60 * 60 * 1000;
    return amount * 60 * 1000;
  }
}
