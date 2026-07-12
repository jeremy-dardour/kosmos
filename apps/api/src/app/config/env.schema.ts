import { z } from 'zod';

import { baseEnvSchema } from '@/shared/types/env.base.schema';
import { validateEnvSchema } from '@/shared/utils/env.validator';

export const envSchema = baseEnvSchema.extend({
  PORT: z
    .string()
    .default('3000')
    .transform(Number)
    .refine((value) => value > 0 && value < 65_536, {
      message: 'PORT must be between 1-65535',
    }),

  AUTH_CLIENT_ID: z.string(),
  AUTH_OIDC_DISCOVERY_URL: z.url(),
  AUTH_ACCEPTED_SCOPES: z
    .string()
    .transform((value) => value.split(',').map((scope) => scope.trim()))
    .refine((value) => value.length > 0 && value.every((s) => s.length > 0), {
      message:
        'AUTH_ACCEPTED_SCOPES must be a comma-separated list of non-empty scopes',
    }),
  FAKE_AUTH: z
    .string()
    .default('false')
    .transform((value) => value.toLowerCase() === 'true')
    .refine((value) => typeof value === 'boolean'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  return validateEnvSchema(envSchema, config, 'App');
}
