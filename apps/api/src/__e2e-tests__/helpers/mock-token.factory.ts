import { SignJWT } from 'jose';

import { MockOidcService } from '@/__e2e-tests__/mocks/mock-oidc.service';

import type { JwtPayload } from '@/app/auth';
import type { GenerateKeyPairResult } from 'jose';

export class MockTokenFactory {
  private readonly privateKey: GenerateKeyPairResult['privateKey'];
  private readonly audience: string;
  private readonly defaultScope: string;

  constructor(
    mockOidc: MockOidcService,
    audience: string,
    acceptedScope: string,
  ) {
    this.privateKey = mockOidc.getPrivateKey();
    this.audience = audience;
    this.defaultScope = acceptedScope;
  }

  async createToken(
    options: Partial<JwtPayload> & {
      expiresInSeconds?: number;
      expired?: boolean;
    } = {},
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    const {
      sub = 'e2e-user-123',
      email = 'e2e@example.com',
      name = 'E2E Test User',
      scp = this.defaultScope,
      aud = this.audience,
      iss = MockOidcService.ISSUER,
      expiresInSeconds = 3600,
      expired = false,
    } = options;

    const iat = expired ? now - expiresInSeconds - 60 : now;
    const exp = expired ? now - 60 : now + expiresInSeconds;

    return new SignJWT({
      sub,
      email,
      name,
      preferred_username: email,
      scp,
    })
      .setProtectedHeader({
        alg: 'RS256',
        kid: MockOidcService.KEY_ID,
      })
      .setIssuedAt(iat)
      .setExpirationTime(exp)
      .setIssuer(iss)
      .setAudience(aud)
      .sign(this.privateKey);
  }

  async validToken(): Promise<string> {
    return this.createToken();
  }

  async expiredToken(): Promise<string> {
    return this.createToken({ expired: true });
  }

  async wrongScopeToken(): Promise<string> {
    return this.createToken({ scp: 'unrelated.scope' });
  }

  async wrongAudienceToken(): Promise<string> {
    return this.createToken({ aud: 'wrong-audience' });
  }

  async wrongIssuerToken(): Promise<string> {
    return this.createToken({ iss: 'https://wrong-issuer.local' });
  }
}
