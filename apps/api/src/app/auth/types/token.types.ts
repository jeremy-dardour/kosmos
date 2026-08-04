import type { jwtPayloadSchema } from '@/app/auth/schemas/jwt-payload.schemas';
import type { User } from '@/database/entities/user.entity';
import type { Request } from 'express';
import type z from 'zod';

export type JwtPayload = z.infer<typeof jwtPayloadSchema>;

export interface VerifiedToken {
  payload: JwtPayload;
  protectedHeader: Record<string, unknown>;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

export interface AuthenticatedUser {
  id?: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

export interface CurrentUserRequest extends AuthenticatedRequest {
  /** Stashed by {@link CurrentUserInterceptor}; read via the `@CurrentUser()` decorator. */
  currentUser?: User;
}
