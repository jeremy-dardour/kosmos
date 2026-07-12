import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AuthInitializerService } from '@/app/auth';
import { corsConfig } from '@/app/config/security.config';
import { setupSwagger } from '@/app/config/swagger.config';
import { createValidationPipe } from '@/app/config/validation.config';
import { AllExceptionsFilter } from '@/app/filters/all-exceptions.filter';
import { ProblemDetailsFilter } from '@/app/filters/problem-details.filter';
import { ThrottlerExceptionFilter } from '@/app/filters/throttler-exception.filter';
import { ContextHeadersInterceptor } from '@/app/interceptors/context-headers.interceptor';
import { LinkHeaderInterceptor } from '@/app/interceptors/link-header.interceptor';
import { LocationHeaderInterceptor } from '@/app/interceptors/location-header.interceptor';
import { TimeoutInterceptor } from '@/app/interceptors/timeout.interceptor';

import { AppModule } from './app.module';

import type { Env } from '@/app/config/env.schema';
import type { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true, // Buffer logs until Logger is ready
  });

  // Trust X-Forwarded-* from the reverse proxy in front (ALB, nginx, ...):
  // absolute URLs (Location/Link headers) get the right protocol and the
  // throttler sees real client IPs. See docs/adr/0003-trust-proxy.md.
  app.set('trust proxy', true);
  const logger = app.get(Logger);
  const configService = app.get(ConfigService<Env, true>);
  const env: Env['NODE_ENV'] = configService.get('NODE_ENV');

  // Use nestjs-pino Logger
  app.useLogger(logger);

  // Initialize OIDC discovery service (if not in fake auth mode)
  const authInitializer = app.get(AuthInitializerService);
  await authInitializer.init();

  // CORS config
  app.enableCors(corsConfig);

  // Global route prefix
  app.setGlobalPrefix('api', {
    exclude: [
      // Exclude Swagger dev credentials endpoint
      { path: '.well-known', method: RequestMethod.ALL },
      { path: '.well-known/{*path}', method: RequestMethod.ALL },
      // Exclude health check endpoints
      { path: 'health', method: RequestMethod.ALL },
      { path: 'health/{*path}', method: RequestMethod.ALL },
    ],
  });

  // Global exception filters (specific to general)
  app.useGlobalFilters(
    app.get(ThrottlerExceptionFilter),
    app.get(ProblemDetailsFilter),
    app.get(AllExceptionsFilter),
  );

  // Global interceptors (in execution order)
  app.useGlobalInterceptors(
    // 1. Tracing headers (X-Request-Id, X-Correlation-Id, Trace-Id)
    app.get(ContextHeadersInterceptor),

    // 2. Timeout control (15s)
    new TimeoutInterceptor(15_000),

    // 3. Location header (201 Created)
    new LocationHeaderInterceptor(),

    // 4. Link header (pagination links)
    new LinkHeaderInterceptor(),
  );

  // Global validation pipe
  app.useGlobalPipes(createValidationPipe());

  // Swagger docs
  setupSwagger(app);

  const port: Env['PORT'] = configService.get('PORT');
  await app.listen(port);

  const nodeVersion = process.version;
  const baseUrl = `http://localhost:${port}`;

  const startupMessage = `
+-----------------------------------------------------+
|                     API Server                      |
+-----------------------------------------------------+
|  Environment:  ${env.padEnd(35)}  |
|  Port:         ${String(port).padEnd(35)}  |
|  Node:         ${nodeVersion.padEnd(35)}  |
+-----------------------------------------------------+
|  Endpoints:                                         |
|  - API:        ${`${baseUrl}/api`.padEnd(35)}  |
|  - Docs:       ${`${baseUrl}/api/docs`.padEnd(35)}  |
|  - Swagger:    ${`${baseUrl}/api/swagger`.padEnd(35)}  |
|  - YAML:       ${`${baseUrl}/openapi.yaml`.padEnd(35)}  |
|  - Health:     ${`${baseUrl}/health`.padEnd(35)}  |
+-----------------------------------------------------+`;

  logger.log(startupMessage);
}

// eslint-disable-next-line unicorn/prefer-top-level-await, unicorn/prefer-await
bootstrap().catch((error) => {
  // Exit non-zero so orchestrators treat a failed boot as a crash, not a clean start
  console.error(error);
  process.exitCode = 1;
});
