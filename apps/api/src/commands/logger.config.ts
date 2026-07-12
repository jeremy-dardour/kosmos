import type { Env } from '@/commands/env.schema';
import type { ConfigService } from '@nestjs/config';

/**
 * CLI logger configuration
 * Simplified logger for CLI commands (no HTTP concerns)
 */
export function createCliLogger(config: ConfigService<Env, true>) {
  const isProduction = config.get('NODE_ENV') === 'production';

  return {
    level: isProduction ? 'info' : 'debug',
    redact: {
      paths: ['*.password', '*.token', '*.secret'], // minimal sensitive redaction
      censor: '[REDACTED]',
    },
    ...(!isProduction && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          singleLine: true,
          translateTime: 'HH:MM:ss',
        },
      },
    }),
  };
}
