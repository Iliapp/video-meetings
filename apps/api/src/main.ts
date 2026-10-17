import type { Server } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module';

// Node's default (300 s) would cut off a 2 GB recording upload on a slow
// connection. Kept finite so slow-request protection still applies.
const REQUEST_TIMEOUT_MS = 2 * 60 * 60 * 1000;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  app.enableCors({
    origin: (process.env.WEB_ORIGIN ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter(Boolean),
  });
  (app.getHttpServer() as Server).requestTimeout = REQUEST_TIMEOUT_MS;
  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
