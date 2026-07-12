import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '@/app/auth/types/token.types';

export interface AuthStrategy {
  authenticate(request: AuthenticatedRequest): Promise<AuthenticatedUser>;
}
