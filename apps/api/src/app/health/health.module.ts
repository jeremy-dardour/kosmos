import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { HealthController } from '@/app/health/health.controller';
import { MikroORMHealthIndicator } from '@/app/health/mikro-orm.health';

/**
 * Health check module - database, memory, and disk checks
 * Database connection provided by global DatabaseModule
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [MikroORMHealthIndicator],
})
export class HealthModule {}
