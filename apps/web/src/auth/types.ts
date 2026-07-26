import type { CurrentUser } from '@/api/current-user';

/**
 * The signed-in identity, as the server reports it.
 *
 * Derived from the OpenAPI contract rather than hand-declared, so a change to
 * `CurrentUserDto` surfaces here as a type error instead of silent drift.
 */
export type AuthenticatedUser = CurrentUser;
