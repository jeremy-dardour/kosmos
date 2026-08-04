import { SetMetadata } from '@nestjs/common';

export const SKIP_USER_RESOLUTION_KEY = 'skipUserResolution';

/**
 * Opts a controller or route out of the globally bound
 * `CurrentUserInterceptor`. Reserved for authenticated routes that must run
 * before a persisted user exists — `/users/me` is what provisions the row the
 * resolution requires. Public routes need no opt-out: with no authenticated
 * principal there is nothing to resolve.
 */
export const SkipUserResolution = () =>
  SetMetadata(SKIP_USER_RESOLUTION_KEY, true);
