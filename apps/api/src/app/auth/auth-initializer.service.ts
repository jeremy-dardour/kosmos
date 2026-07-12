import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { OidcDiscoveryService } from '@/app/auth/strategies/jwt/oidc-discovery.service';
import { shouldUseMockAuth } from '@/app/auth/utils/should-use-mock-auth.util';

import type { Env } from '@/app/config/env.schema';

@Injectable()
export class AuthInitializerService {
  private readonly logger = new Logger(AuthInitializerService.name);

  constructor(
    private readonly configService: ConfigService<Env, true>,
    private readonly oidcDiscoveryService: OidcDiscoveryService,
  ) {}

  async init(): Promise<void> {
    if (shouldUseMockAuth(this.configService)) {
      this.logger.warn(
        'FAKE_AUTH enabled - skipping authentication provider initialization',
      );
      return;
    }
    await this.oidcDiscoveryService.init();
  }
}
