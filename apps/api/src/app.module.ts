import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';

import { AuthModule, AuthGuard } from '@/app/auth';
import { createClsConfig } from '@/app/config/cls.config';
import { validateEnv } from '@/app/config/env.schema';
import { throttlerConfig } from '@/app/config/security.config';
import { AllExceptionsFilter } from '@/app/filters/all-exceptions.filter';
import { ProblemDetailsFilter } from '@/app/filters/problem-details.filter';
import { ThrottlerExceptionFilter } from '@/app/filters/throttler-exception.filter';
import { HealthModule } from '@/app/health/health.module';
import { ContextHeadersInterceptor } from '@/app/interceptors/context-headers.interceptor';
import { LoggerModule } from '@/app/logger/logger.module';
import { SwaggerDevController } from '@/app/swagger/swagger-dev.controller';
import { DatabaseModule } from '@/database/database.module';
import { ItemModule } from '@/modules/item/item.module';

import type { NestModule, MiddlewareConsumer } from '@nestjs/common';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      cache: true,
    }),
    ClsModule.forRoot(createClsConfig()),
    LoggerModule,
    AuthModule,
    DatabaseModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: throttlerConfig.ttl,
        limit: throttlerConfig.limit,
      },
    ]),
    HealthModule,
    ItemModule,
  ],
  controllers: [
    ...(process.env.NODE_ENV === 'production' ? [] : [SwaggerDevController]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useExisting: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    AllExceptionsFilter,
    ProblemDetailsFilter,
    ThrottlerExceptionFilter,
    ContextHeadersInterceptor,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply().forRoutes('{*path}');
  }
}
