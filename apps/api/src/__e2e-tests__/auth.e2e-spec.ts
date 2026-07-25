import { JOSEError } from 'jose/errors';
import request from 'supertest';

import { createTestApp } from '@/__e2e-tests__/helpers/create-app.helper';
import { MockTokenFactory } from '@/__e2e-tests__/helpers/mock-token.factory';
import { MockOidcService } from '@/__e2e-tests__/mocks/mock-oidc.service';
import { OidcServiceUnavailableException } from '@/app/auth/exceptions/oidc-service-unavailable.exception';

import type { OidcDiscoveryService } from '@/app/auth/strategies/jwt/oidc-discovery.service';
import type { INestApplication } from '@nestjs/common';
import type { Test as SuperTestType } from 'supertest';
import type TestAgent from 'supertest/lib/agent';

function createRequest(app: INestApplication): TestAgent<SuperTestType> {
  return request(app.getHttpServer() as never);
}

function isCurrentUserResponse(value: unknown): value is {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
} {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const body = value as Record<string, unknown>;
  return (
    typeof body.id === 'string' &&
    typeof body.email === 'string' &&
    typeof body.name === 'string' &&
    typeof body.avatarUrl === 'string'
  );
}

describe('Auth E2E Tests', () => {
  const mockOidc = new MockOidcService();
  let tokenFactory: MockTokenFactory;

  beforeAll(async () => {
    const clientId = process.env.AUTH_CLIENT_ID!;
    const audience = clientId;

    await mockOidc.setup();
    tokenFactory = new MockTokenFactory(mockOidc, audience);
  });

  const PROTECTED_ENDPOINT = '/__e2e__/protected';
  const CURRENT_USER_ENDPOINT = '/users/me';

  describe('with valid OIDC configuration', () => {
    let app: INestApplication;

    beforeEach(async () => {
      app = await createTestApp({ oidcOverride: mockOidc });
    });

    afterEach(async () => {
      await app.close();
    });

    it('should return 200 with valid token and allowed email', async () => {
      const token = await tokenFactory.validToken();

      await createRequest(app)
        .get(PROTECTED_ENDPOINT)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should return current user for valid token and allowed email', async () => {
      const token = await tokenFactory.validToken();

      const response = await createRequest(app)
        .get(CURRENT_USER_ENDPOINT)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(isCurrentUserResponse(response.body)).toBe(true);

      if (!isCurrentUserResponse(response.body)) {
        throw new Error('Expected current user response body');
      }

      expect(response.body.id).toMatch(
        /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu,
      );
      expect(response.body.email).toBe('e2e@example.com');
      expect(response.body.name).toBe('E2E Test User');
      expect(response.body.avatarUrl).toBe('https://example.com/avatar.jpg');
    });

    it('should return 401 when no authorization header is provided', async () => {
      await createRequest(app).get(PROTECTED_ENDPOINT).expect(401);
    });

    it('should return 401 for /users/me when no authorization header is provided', async () => {
      await createRequest(app).get(CURRENT_USER_ENDPOINT).expect(401);
    });

    it('should return 401 for malformed authorization header', async () => {
      await createRequest(app)
        .get(PROTECTED_ENDPOINT)
        .set('Authorization', 'InvalidFormat')
        .expect(401);
    });

    it('should return 401 for non-Bearer scheme', async () => {
      await createRequest(app)
        .get(PROTECTED_ENDPOINT)
        .set('Authorization', 'Basic dXNlcjpwYXNz')
        .expect(401);
    });

    it('should return 401 for tampered/invalid token', async () => {
      await createRequest(app)
        .get(PROTECTED_ENDPOINT)
        .set('Authorization', 'Bearer not.a.valid.jwt')
        .expect(401);
    });

    it('should return 401 for expired token', async () => {
      const token = await tokenFactory.expiredToken();

      await createRequest(app)
        .get(PROTECTED_ENDPOINT)
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('should return 401 for wrong audience', async () => {
      const token = await tokenFactory.wrongAudienceToken();

      await createRequest(app)
        .get(PROTECTED_ENDPOINT)
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('should return 401 for wrong issuer', async () => {
      const token = await tokenFactory.wrongIssuerToken();

      await createRequest(app)
        .get(PROTECTED_ENDPOINT)
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('should return 403 for valid token with email outside allow-list', async () => {
      const token = await tokenFactory.disallowedEmailToken();

      await createRequest(app)
        .get(PROTECTED_ENDPOINT)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('should return 403 for /users/me with email outside allow-list', async () => {
      const token = await tokenFactory.disallowedEmailToken();

      await createRequest(app)
        .get(CURRENT_USER_ENDPOINT)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('should return 403 for valid token with unverified email', async () => {
      const token = await tokenFactory.unverifiedEmailToken();

      await createRequest(app)
        .get(PROTECTED_ENDPOINT)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('with OIDC service unavailable', () => {
    describe('when OIDC discovery URL does not resolve (service not initialized)', () => {
      let app: INestApplication;

      beforeAll(async () => {
        app = await createTestApp({
          oidcOverride: {
            init: async () => await Promise.resolve(),
            getJWKSet: () => {
              throw new OidcServiceUnavailableException(
                'OIDC service not initialized',
              );
            },
            getIssuer: () => {
              throw new OidcServiceUnavailableException(
                'OIDC service not initialized',
              );
            },
            isInitialized: () => false,
          },
        });
      });

      afterAll(async () => {
        await app.close();
      });

      it('should return 503 when OIDC service is not initialized', async () => {
        const token = await tokenFactory.validToken();

        await createRequest(app)
          .get(PROTECTED_ENDPOINT)
          .set('Authorization', `Bearer ${token}`)
          .expect(503);
      });
    });

    describe('when JWKS URL does not resolve', () => {
      let app: INestApplication;

      beforeAll(async () => {
        app = await createTestApp({
          oidcOverride: {
            init: async () => await Promise.resolve(),
            getJWKSet: () =>
              (() => {
                throw new JOSEError('Failed to fetch remote JWKS');
              }) as unknown as ReturnType<OidcDiscoveryService['getJWKSet']>,
            getIssuer: () => MockOidcService.ISSUER,
            isInitialized: () => true,
          },
        });
      });

      afterAll(async () => {
        await app.close();
      });

      it('should return 503 when JWKS endpoint is unreachable', async () => {
        const token = await tokenFactory.validToken();

        await createRequest(app)
          .get(PROTECTED_ENDPOINT)
          .set('Authorization', `Bearer ${token}`)
          .expect(503);
      });
    });
  });
});
