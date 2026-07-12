import type { jwtPayloadSchema } from '@/app/auth/schemas/jwt-payload.schemas';
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
  email?: string;
  name?: string;
  preferred_username?: string;
  roles?: string[];
}
