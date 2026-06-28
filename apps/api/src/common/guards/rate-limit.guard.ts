import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Request } from 'express';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

@Injectable()
export class RateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const limit = Number(process.env.RATE_LIMIT_MAX ?? 240);
    const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
    const key = `${request.ip}:${request.path}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    bucket.count += 1;
    if (bucket.count > limit) throw new HttpException('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    return true;
  }
}
