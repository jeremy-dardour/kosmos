import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthGuard } from '@/app/auth/auth.guard';
import { IS_PUBLIC_KEY } from '@/app/auth/decorators';
import { AuthenticationException } from '@/app/auth/exceptions/authentication.exception';

import type { JwtAuthStrategy } from '@/app/auth/strategies/jwt/jwt-auth.strategy';
import type { MockAuthStrategy } from '@/app/auth/strategies/mock-auth.strategy';
import type {
  AuthenticatedRequest,
  JwtPayload,
} from '@/app/auth/types/token.types';
import type { Env } from '@/app/config/env.schema';
import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';

describe('authGuard', () => {
  let guard: AuthGuard;
  let configService: ConfigService<Env, true>;
  let reflector: Reflector;
  let jwtAuthStrategy: JwtAuthStrategy;
  let mockAuthStrategy: MockAuthStrategy;

  const mockPayload: JwtPayload = {
    sub: 'user-123',
    email: 'user@example.com',
    name: 'Test User',
    preferred_username: 'user@example.com',
    scp: 'api.read',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    iss: 'https://auth.example.com',
    aud: 'test-client-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    reflector = {
      getAllAndOverride: vi.fn(),
    } as unknown as Reflector;

    jwtAuthStrategy = {
      authenticate: vi.fn().mockResolvedValue(mockPayload),
    } as unknown as JwtAuthStrategy;

    mockAuthStrategy = {
      authenticate: vi.fn().mockResolvedValue(mockPayload),
    } as unknown as MockAuthStrategy;
  });

  describe('strategy selection', () => {
    it('should use JWT strategy when FAKE_AUTH is false', async () => {
      configService = {
        get: vi.fn((key: keyof Env) => {
          if (key === 'FAKE_AUTH') return false;
          if (key === 'NODE_ENV') return 'development';
          return;
        }),
      } as unknown as ConfigService<Env, true>;

      guard = new AuthGuard(
        configService,
        reflector,
        jwtAuthStrategy,
        mockAuthStrategy,
      );

      vi.mocked(reflector.getAllAndOverride).mockReturnValueOnce(false);
      const context = createMockExecutionContext();

      await guard.canActivate(context);

      expect(jwtAuthStrategy.authenticate).toHaveBeenCalledWith(
        context.switchToHttp().getRequest(),
      );
      expect(mockAuthStrategy.authenticate).not.toHaveBeenCalled();
    });

    it('should use Mock strategy when FAKE_AUTH is true and NODE_ENV is not production', async () => {
      configService = {
        get: vi.fn((key: keyof Env) => {
          if (key === 'FAKE_AUTH') return true;
          if (key === 'NODE_ENV') return 'development';
          return;
        }),
      } as unknown as ConfigService<Env, true>;

      guard = new AuthGuard(
        configService,
        reflector,
        jwtAuthStrategy,
        mockAuthStrategy,
      );

      vi.mocked(reflector.getAllAndOverride).mockReturnValueOnce(false);
      const context = createMockExecutionContext();

      await guard.canActivate(context);

      expect(mockAuthStrategy.authenticate).toHaveBeenCalledWith(
        context.switchToHttp().getRequest(),
      );
      expect(jwtAuthStrategy.authenticate).not.toHaveBeenCalled();
    });

    it('should use JWT strategy when FAKE_AUTH is true but NODE_ENV is production', async () => {
      configService = {
        get: vi.fn((key: keyof Env) => {
          if (key === 'FAKE_AUTH') return true;
          if (key === 'NODE_ENV') return 'production';
          return;
        }),
      } as unknown as ConfigService<Env, true>;

      guard = new AuthGuard(
        configService,
        reflector,
        jwtAuthStrategy,
        mockAuthStrategy,
      );

      vi.mocked(reflector.getAllAndOverride).mockReturnValueOnce(false);
      const context = createMockExecutionContext();

      await guard.canActivate(context);

      expect(jwtAuthStrategy.authenticate).toHaveBeenCalledWith(
        context.switchToHttp().getRequest(),
      );
      expect(mockAuthStrategy.authenticate).not.toHaveBeenCalled();
    });
  });

  describe('public routes', () => {
    beforeEach(() => {
      configService = {
        get: vi.fn((key: keyof Env) => {
          if (key === 'FAKE_AUTH') return false;
          if (key === 'NODE_ENV') return 'development';
          return;
        }),
      } as unknown as ConfigService<Env, true>;

      guard = new AuthGuard(
        configService,
        reflector,
        jwtAuthStrategy,
        mockAuthStrategy,
      );
    });

    it('should allow access to public routes without calling any strategy', async () => {
      vi.mocked(reflector.getAllAndOverride).mockReturnValueOnce(true);

      const context = createMockExecutionContext();
      const isResult = await guard.canActivate(context);

      expect(isResult).toBe(true);
      expect(jwtAuthStrategy.authenticate).not.toHaveBeenCalled();
      expect(mockAuthStrategy.authenticate).not.toHaveBeenCalled();
    });

    it('should check IS_PUBLIC_KEY metadata on both handler and class', async () => {
      vi.mocked(reflector.getAllAndOverride).mockReturnValueOnce(true);

      const context = createMockExecutionContext();
      await guard.canActivate(context);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });
  });

  describe('protected routes', () => {
    beforeEach(() => {
      configService = {
        get: vi.fn((key: keyof Env) => {
          if (key === 'FAKE_AUTH') return false;
          if (key === 'NODE_ENV') return 'development';
          return;
        }),
      } as unknown as ConfigService<Env, true>;

      guard = new AuthGuard(
        configService,
        reflector,
        jwtAuthStrategy,
        mockAuthStrategy,
      );
    });

    it('should call authentication strategy for protected routes', async () => {
      vi.mocked(reflector.getAllAndOverride).mockReturnValueOnce(false);

      const context = createMockExecutionContext();
      const isResult = await guard.canActivate(context);

      expect(isResult).toBe(true);
      expect(jwtAuthStrategy.authenticate).toHaveBeenCalledTimes(1);
    });

    it('should set user payload on request after successful authentication', async () => {
      vi.mocked(reflector.getAllAndOverride).mockReturnValueOnce(false);

      const context = createMockExecutionContext();
      await guard.canActivate(context);

      const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
      expect(request.user).toEqual(mockPayload);
    });

    it('should propagate authentication errors from strategy', async () => {
      vi.mocked(reflector.getAllAndOverride).mockReturnValueOnce(false);
      vi.mocked(jwtAuthStrategy.authenticate).mockRejectedValueOnce(
        new AuthenticationException('Invalid token'),
      );

      const context = createMockExecutionContext();

      await expect(guard.canActivate(context)).rejects.toThrow(
        AuthenticationException,
      );
    });
  });
});

const createMockExecutionContext = (): ExecutionContext => {
  const request = {
    headers: {},
    user: undefined,
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: vi.fn(),
    getClass: vi.fn(),
  } as unknown as ExecutionContext;
};
