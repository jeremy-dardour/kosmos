import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL: z.url().optional(),
  DEV: z.boolean(),
  VITE_FAKE_AUTH: z
    .string()
    .transform((v) => v === 'true')
    .optional()
    .default(false),
});

type ValidatedEnv = z.infer<typeof envSchema>;

let validatedEnv: ValidatedEnv | null = null;
let validationError: Error | null = null;

function getEnv(): ValidatedEnv {
  if (validationError) {
    throw validationError;
  }

  if (validatedEnv) {
    return validatedEnv;
  }

  const result = envSchema.safeParse(import.meta.env);

  if (!result.success) {
    const errorDetails = JSON.stringify(z.treeifyError(result.error), null, 2);
    const errorMessage = `Invalid environment variables:\n${errorDetails}\n\nCheck your .env file.`;
    console.error(errorMessage);
    // eslint-disable-next-line unicorn/no-top-level-assignment-in-function
    validationError = new Error(errorMessage);
    throw validationError;
  }

  // eslint-disable-next-line unicorn/no-top-level-assignment-in-function
  validatedEnv = result.data;
  return validatedEnv;
}

export const env = {
  get apiUrl() {
    return getEnv().VITE_API_URL ?? globalThis.location.origin;
  },
  get dev() {
    return getEnv().DEV;
  },
  get fakeAuth() {
    return getEnv().VITE_FAKE_AUTH;
  },
} as const;
