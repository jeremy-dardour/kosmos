import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jwtVerify } from 'jose';
import {
  JWTExpired,
  JWTClaimValidationFailed,
  JWSSignatureVerificationFailed,
  JOSEError,
} from 'jose/errors';

import { ExpiredTokenException } from '@/app/auth/exceptions/expired-token.exception';
import { ForbiddenEmailException } from '@/app/auth/exceptions/forbidden-email.exception';
import { InvalidTokenException } from '@/app/auth/exceptions/invalid-token.exception';
import { OidcServiceUnavailableException } from '@/app/auth/exceptions/oidc-service-unavailable.exception';
import { jwtPayloadSchema } from '@/app/auth/schemas/jwt-payload.schemas';
import { OidcDiscoveryService } from '@/app/auth/strategies/jwt/oidc-discovery.service';

import type { JwtPayload, VerifiedToken } from '@/app/auth/types/token.types';
import type { Env } from '@/app/config/env.schema';

@Injectable()
export class JwtVerificationService {
  constructor(
    private readonly oidcService: OidcDiscoveryService,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  async verify(token: string): Promise<VerifiedToken> {
    try {
      const jwks = this.oidcService.getJWKSet();
      const issuer = this.oidcService.getIssuer();
      const audience: string | undefined = this.configService.get(
        'AUTH_CLIENT_ID',
        { infer: true },
      );

      const { payload, protectedHeader } = await jwtVerify(token, jwks, {
        issuer,
        audience,
      });
      const parseResult = jwtPayloadSchema.safeParse(payload);

      if (!parseResult.success) {
        throw new InvalidTokenException(`Invalid token payload structure`);
      }

      const validatedPayload = parseResult.data;
      this.validateAllowedEmail(validatedPayload);

      return {
        payload: validatedPayload,
        protectedHeader,
      };
    } catch (error) {
      if (error instanceof JWTExpired) {
        throw new ExpiredTokenException();
      }

      if (error instanceof JWSSignatureVerificationFailed) {
        throw new InvalidTokenException();
      }

      if (error instanceof JWTClaimValidationFailed) {
        throw new InvalidTokenException(
          `Token validation failed: ${error.message}`,
        );
      }

      if (error instanceof JOSEError && error.code === 'ERR_JOSE_GENERIC') {
        throw new OidcServiceUnavailableException(
          'Failed to fetch JWKS from identity provider',
        );
      }

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InvalidTokenException(
        error instanceof Error ? error.message : 'Token verification failed',
      );
    }
  }

  private validateAllowedEmail({ email, email_verified }: JwtPayload): void {
    const allowedEmails: string[] =
      this.configService.get('AUTH_ALLOWED_EMAILS', { infer: true }) ?? [];
    const normalizedEmail = email?.toLowerCase();

    if (
      !normalizedEmail ||
      email_verified !== true ||
      !allowedEmails.includes(normalizedEmail)
    ) {
      throw new ForbiddenEmailException();
    }
  }
}
