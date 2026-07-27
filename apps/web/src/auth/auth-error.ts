export type AuthErrorCode =
  | 'forbidden'
  // `sign_in_failed` and `token_rejected` both mean "no session, sign in
  // again"; `validation_failed` means the check itself could not run, which is
  // an error state the user cannot resolve by signing in.
  | 'sign_in_failed'
  | 'token_rejected'
  | 'validation_failed';

/**
 * A failure of authentication itself. The provider maps `code` onto the next
 * `AuthState`, so branch on `code` — never on `message`, which is only ever
 * shown or logged.
 */
export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
