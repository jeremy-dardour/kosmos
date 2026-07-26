export type AuthErrorCode =
  | 'forbidden'
  | 'sign_in_failed'
  // The server refused the token (401). Distinct from `validation_failed`,
  // which means validation could not be completed at all — a rejected token
  // sends the user back to sign-in, an unreachable server is an error state.
  | 'token_rejected'
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
