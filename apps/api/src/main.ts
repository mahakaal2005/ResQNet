import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // whitelist strips properties no DTO declares, so a client cannot smuggle a
  // field past validation; transform turns query/body primitives into the
  // declared types.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  // The dashboard is served from a different origin in dev (Next.js on 3001).
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? true, credentials: true });

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
