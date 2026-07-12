import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet } from 'jose';
import * as oidc from 'openid-client';

import { OidcServiceUnavailableException } from '@/app/auth/exceptions/oidc-service-unavailable.exception';

import type { Env } from '@/app/config/env.schema';

@Injectable()
export class OidcDiscoveryService {
  private issuer: string | null = null;
  private jwksFunction: ReturnType<typeof createRemoteJWKSet> | null = null;
  private readonly discoveryUrl: URL;

  constructor(private readonly configService: ConfigService<Env, true>) {
    const discoveryUrl: string = this.configService.get(
      'AUTH_OIDC_DISCOVERY_URL',
    );
    this.discoveryUrl = new URL(discoveryUrl);
  }

  async init(): Promise<void> {
    try {
      const clientId: string = this.configService.get('AUTH_CLIENT_ID');

      const config = await oidc.discovery(
        this.discoveryUrl,
        clientId,
        undefined,
        oidc.None(),
        {
          timeout: 30,
        },
      );

      const serverMetadata = config.serverMetadata();

      if (!serverMetadata.issuer || !serverMetadata.jwks_uri) {
        throw new Error('Invalid OIDC configuration: missing required fields');
      }

      this.issuer = serverMetadata.issuer;

      this.jwksFunction = createRemoteJWKSet(new URL(serverMetadata.jwks_uri));
    } catch {
      throw new OidcServiceUnavailableException(
        'Failed to initialize OIDC discovery service',
      );
    }
  }

  getJWKSet(): ReturnType<typeof createRemoteJWKSet> {
    if (!this.jwksFunction) {
      throw new OidcServiceUnavailableException(
        'OidcDiscoveryService not initialized. Call init() during bootstrap.',
      );
    }
    return this.jwksFunction;
  }

  getIssuer(): string {
    if (!this.issuer) {
      throw new OidcServiceUnavailableException(
        'OidcDiscoveryService not initialized. Call init() during bootstrap.',
      );
    }
    return this.issuer;
  }

  isInitialized(): boolean {
    return this.issuer !== null && this.jwksFunction !== null;
  }
}
