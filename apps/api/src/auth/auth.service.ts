import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('Email is already registered');
    const user = await this.prisma.user.create({ data: { email, fullName: dto.fullName, passwordHash: await bcrypt.hash(dto.password, 12) } });
    return this.authResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase().trim() } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) throw new UnauthorizedException('Invalid email or password');
    return this.authResponse(user);
  }

  async me(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, omit: { passwordHash: true } });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  private authResponse(user: User) {
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return { accessToken: this.jwt.sign({ sub: user.id, email: user.email, role: user.role }), user: safeUser };
  }
}
