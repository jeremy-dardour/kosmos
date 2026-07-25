export type AuthErrorCode =
  | 'forbidden'
  | 'sign_in_failed'
  | 'validation_failed';

export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
