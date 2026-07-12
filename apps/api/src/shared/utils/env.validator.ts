import { z } from 'zod';

/**
 * Generic environment validation function
 * Reusable across all environment schemas
 *
 * @param schema - Zod schema to validate against
 * @param config - Environment variables to validate
 * @param context - Context name for error messages (e.g., 'App', 'Job')
 * @returns Parsed and validated environment variables
 * @throws {Error} if validation fails
 */
export function validateEnvSchema<T extends z.ZodType>(
  schema: T,
  config: Record<string, unknown>,
  context: string = 'Environment',
): z.infer<T> {
  try {
    return schema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues
        .map(
          (error_: z.core.$ZodIssue) =>
            `${error_.path.join('.')}: ${error_.message}`,
        )
        .join('\n');

      throw new Error(
        `${context} environment validation failed:\n${errorMessages}\n\nCheck .env file or environment variables`,
      );
    }
    throw error;
  }
}
