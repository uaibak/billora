import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true, credentials: true });
  app.useStaticAssets(join(process.cwd(), 'storage'), { prefix: '/uploads' });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.on('finish', () => {
      if (process.env.NODE_ENV !== 'test') console.log(`${requestId} ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`);
    });
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
