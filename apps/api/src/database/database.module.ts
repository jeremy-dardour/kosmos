import { EntityManager } from '@mikro-orm/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver, SqlEntityManager } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { BaseEnv } from '@/shared/types/env.base.schema';
import type { DynamicModule } from '@nestjs/common';

/**
 * MikroORM database module
 *
 * Configures MikroORM with NestJS integration
 */
@Module({})
export class DatabaseModule {
  /**
   * Create global database connection using ConfigService
   */
  static forRoot(): DynamicModule {
    return {
      module: this,
      global: true,

      imports: [
        MikroOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (configService: ConfigService<BaseEnv, true>) => {
            const isProduction =
              configService.get('NODE_ENV', { infer: true }) === 'production';

            return {
              driver: PostgreSqlDriver,
              // Connection
              clientUrl: configService.get('DATABASE_URL', { infer: true }),

              // SSL: node-postgres ignores sslmode in URL query params,
              // so we must pass ssl config explicitly for managed PostgreSQL services
              ...(isProduction && {
                driverOptions: {
                  ssl: { rejectUnauthorized: false },
                },
              }),

              autoLoadEntities: true, // prevents needing to register entities manually in mikro orm module

              metadataProvider: TsMorphMetadataProvider,
              // Connection pool
              pool: {
                min: configService.get('DB_POOL_MIN', { infer: true }),
                max: configService.get('DB_POOL_MAX', { infer: true }),
                idleTimeoutMillis: configService.get('DB_POOL_IDLE_TIMEOUT', {
                  infer: true,
                }),
                acquireTimeoutMillis: configService.get(
                  'DB_POOL_CONNECTION_TIMEOUT',
                  { infer: true },
                ),
              },

              // Debugging
              debug: !isProduction, // When true, MikroORM logs all SQL queries to the console

              allowGlobalContext: false, // Disables global context to avoid issues with em sharing accross requests
            };
          },
        }),
      ],
      providers: [
        {
          provide: SqlEntityManager,
          useFactory: (em: EntityManager) => em,
          inject: [EntityManager],
        },
      ],
      exports: [SqlEntityManager],
    };
  }
}
