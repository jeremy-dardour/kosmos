import { baseEnvSchema } from '@/shared/types/env.base.schema';
import { validateEnvSchema } from '@/shared/utils/env.validator';

import type { z } from 'zod';

export const envSchema = baseEnvSchema;

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  return validateEnvSchema(envSchema, config, 'CLI');
}
