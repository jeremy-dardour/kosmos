import { Injectable, Logger } from '@nestjs/common';

import { AuthStrategy } from '@/app/auth/strategies/auth-strategy.interface';
import {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '@/app/auth/types/token.types';

/** Bearer token that picks the second local identity; anything else is the default one. */
const PARTNER_TOKEN = 'mock-partner';

const DEFAULT_IDENTITY: AuthenticatedUser = {
  email: 'mock@example.com',
  name: 'MockUser',
};

const PARTNER_IDENTITY: AuthenticatedUser = {
  email: 'mock-partner@example.com',
  name: 'MockPartner',
};

@Injectable()
export class MockAuthStrategy implements AuthStrategy {
  private readonly logger = new Logger(MockAuthStrategy.name);

  constructor() {
    this.logger.warn(
      '⚠️  MockAuthStrategy initialized - using fake authentication',
    );
  }

  async authenticate(
    request: AuthenticatedRequest,
  ): Promise<AuthenticatedUser> {
    const identity =
      this.extractToken(request) === PARTNER_TOKEN
        ? PARTNER_IDENTITY
        : DEFAULT_IDENTITY;

    return await Promise.resolve({ ...identity });
  }

  private extractToken(request: AuthenticatedRequest): string | undefined {
    const authHeader = request.headers.authorization;

    if (typeof authHeader !== 'string') {
      return;
    }

    const [type, token] = authHeader.split(' ');

    return type === 'Bearer' ? token : undefined;
  }
}
