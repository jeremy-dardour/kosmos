import path from 'node:path';

import { z } from 'zod';

import { baseEnvSchema } from '@/shared/types/env.base.schema';
import { validateEnvSchema } from '@/shared/utils/env.validator';

const allowedEmailsSchema = z
  .string()
  .optional()
  .transform((value) =>
    value
      ?.split(',')
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0),
  )
  .refine(
    (value) =>
      value === undefined || value.every((email) => email.includes('@')),
    {
      message:
        'AUTH_ALLOWED_EMAILS must be a comma-separated list of email addresses',
    },
  );

export const envSchema = baseEnvSchema
  .extend({
    PORT: z
      .string()
      .default('3000')
      .transform(Number)
      .refine((value) => value > 0 && value < 65_536, {
        message: 'PORT must be between 1-65535',
      }),

    // Absolute path to the built SPA; unset disables static serving entirely.
    SERVE_STATIC_DIR: z
      .string()
      .optional()
      .refine((value) => value === undefined || path.isAbsolute(value), {
        message: 'SERVE_STATIC_DIR must be an absolute path',
      }),

    MAX_OWNED_PROJECTS: z
      .string()
      .default('20')
      .transform(Number)
      .refine((value) => Number.isSafeInteger(value) && value > 0, {
        message: 'MAX_OWNED_PROJECTS must be a positive integer',
      }),

    MAX_PROJECT_MEMBERS: z
      .string()
      .default('20')
      .transform(Number)
      .refine((value) => Number.isSafeInteger(value) && value > 0, {
        message: 'MAX_PROJECT_MEMBERS must be a positive integer',
      }),

    AUTH_CLIENT_ID: z.string().optional(),
    AUTH_OIDC_DISCOVERY_URL: z.url().optional(),
    AUTH_ALLOWED_EMAILS: allowedEmailsSchema,
    FAKE_AUTH: z
      .string()
      .default('false')
      .transform((value) => value.toLowerCase() === 'true')
      .refine((value) => typeof value === 'boolean'),
  })
  .superRefine((env, context) => {
    if (env.FAKE_AUTH) {
      return;
    }

    if (!env.AUTH_CLIENT_ID) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_CLIENT_ID'],
        message: 'AUTH_CLIENT_ID is required when FAKE_AUTH=false',
      });
    }

    if (!env.AUTH_OIDC_DISCOVERY_URL) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_OIDC_DISCOVERY_URL'],
        message: 'AUTH_OIDC_DISCOVERY_URL is required when FAKE_AUTH=false',
      });
    }

    if (!env.AUTH_ALLOWED_EMAILS || env.AUTH_ALLOWED_EMAILS.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_ALLOWED_EMAILS'],
        message: 'AUTH_ALLOWED_EMAILS is required when FAKE_AUTH=false',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const env = validateEnvSchema(envSchema, config, 'App');

  // Checked against the raw config, not the parsed env: NODE_ENV defaults to
  // 'development', and mock auth must never activate because the default —
  // rather than an explicit choice — satisfied its environment gate.
  if (
    env.FAKE_AUTH &&
    config.NODE_ENV !== 'development' &&
    config.NODE_ENV !== 'test'
  ) {
    throw new Error(
      'App environment validation failed:\n' +
        'FAKE_AUTH: FAKE_AUTH=true requires NODE_ENV to be explicitly set to development or test\n\n' +
        'Check .env file or environment variables',
    );
  }

  return env;
}
