import { Injectable, Logger } from '@nestjs/common';

import { AuthStrategy } from '@/app/auth/strategies/auth-strategy.interface';
import {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '@/app/auth/types/token.types';

@Injectable()
export class MockAuthStrategy implements AuthStrategy {
  private readonly logger = new Logger(MockAuthStrategy.name);

  constructor() {
    this.logger.warn(
      '⚠️  MockAuthStrategy initialized - using fake authentication',
    );
  }

  async authenticate(
    _request: AuthenticatedRequest,
  ): Promise<AuthenticatedUser> {
    return await Promise.resolve(this.createMockJwtPayload());
  }

  private createMockJwtPayload(): AuthenticatedUser {
    return {
      email: 'mock@example.com',
      name: 'MockUser',
      preferred_username: 'mock@example.com',
      roles: ['user'],
    };
  }
}
