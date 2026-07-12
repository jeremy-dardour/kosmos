import 'dotenv/config';

import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { SeedManager } from '@mikro-orm/seeder';

/**
 * MikroORM CLI configuration
 *
 * Used by MikroORM CLI for migrations and schema management
 * Runtime configuration is handled by the DatabaseModule
 */
export default defineConfig({
  clientUrl: process.env.DATABASE_URL ?? '',

  // SSL: node-postgres ignores sslmode in URL query params,
  // so we must pass ssl config explicitly for managed PostgreSQL services
  ...(process.env.NODE_ENV === 'production' && {
    driverOptions: {
      ssl: { rejectUnauthorized: false },
    },
  }),

  metadataProvider: TsMorphMetadataProvider,
  extensions: [Migrator, SeedManager],
  entities: ['./dist/**/*.entity.js'],
  entitiesTs: ['./src/**/*.entity.ts'],
  seeder: {
    pathTs: './src/database/seeders',
  },
  migrations: {
    pathTs: './src/database/migrations',
    glob: '!(*.d).{js,ts}',
    transactional: true, // Already default, but explicit is good
    allOrNothing: true, // Rollback all if one fails
    snapshot: true, // Enables smart diffing
    path: './dist/src/database/migrations',
  },

  pool: {
    min: Number(process.env.DB_POOL_MIN) || 5,
    max: Number(process.env.DB_POOL_MAX) || 20,
  },

  debug: process.env.NODE_ENV !== 'production',
});
