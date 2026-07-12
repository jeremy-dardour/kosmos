import type { Env } from '@/app/config/env.schema';
import type { ConfigService } from '@nestjs/config';

export function shouldUseMockAuth(
  configService: ConfigService<Env, true>,
): boolean {
  const isFakeAuth: boolean = configService.get('FAKE_AUTH');
  const nodeEnv: string = configService.get('NODE_ENV');

  return isFakeAuth && nodeEnv !== 'production';
}
