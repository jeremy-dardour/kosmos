import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { validateEnv } from '@/commands/env.schema';
import { ExampleModule } from '@/commands/example/example.module';
import { createCliLogger } from '@/commands/logger.config';
import { DatabaseModule } from '@/database/database.module';

import type { Env } from '@/commands/env.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      cache: true,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: createCliLogger(config),
      }),
    }),
    DatabaseModule.forRoot(),
    ExampleModule,
  ],
})
export class CliModule {}
