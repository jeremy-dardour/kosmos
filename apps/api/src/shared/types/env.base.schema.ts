import { z } from 'zod';

/**
 * Base environment variables schema
 * Shared by HTTP app and background jobs/CLI commands
 */
export const baseEnvSchema = z.object({
  // App environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Database connection
  DATABASE_URL: z.url(),

  // Database pool config
  DB_POOL_MAX: z
    .string()
    .default('20')
    .transform(Number)
    .refine((value) => value > 0 && value <= 100, {
      message: 'DB_POOL_MAX must be between 1-100',
    }),

  DB_POOL_MIN: z
    .string()
    .default('5')
    .transform(Number)
    .refine((value) => value >= 0 && value <= 50, {
      message: 'DB_POOL_MIN must be between 0-50',
    }),

  DB_POOL_IDLE_TIMEOUT: z
    .string()
    .default('30000')
    .transform(Number)
    .refine((value) => value >= 1000, {
      message: 'DB_POOL_IDLE_TIMEOUT must be at least 1000ms',
    }),

  DB_POOL_CONNECTION_TIMEOUT: z
    .string()
    .default('10000')
    .transform(Number)
    .refine((value) => value >= 1000, {
      message: 'DB_POOL_CONNECTION_TIMEOUT must be at least 1000ms',
    }),
});

/**
 * Base environment type
 */
export type BaseEnv = z.infer<typeof baseEnvSchema>;
