import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor, ExtractJwt.fromAuthHeaderAsBearerToken()]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow('JWT_SECRET'),
    });
  }
  async validate(payload: { sub: string }): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, email: true, role: true } });
    if (!user) throw new UnauthorizedException();
    return user;
  }
}

function cookieExtractor(request: Request) {
  const cookieHeader = request?.headers?.cookie;
  if (!cookieHeader) return null;
  const cookies = Object.fromEntries(cookieHeader.split(';').map((cookie) => {
    const [key, ...value] = cookie.trim().split('=');
    return [key, decodeURIComponent(value.join('='))];
  }));
  return cookies.billora_access_token ?? null;
}
