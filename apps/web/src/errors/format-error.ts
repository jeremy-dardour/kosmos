import { ApiError } from '@/api/errors';
import {
  isAbortError,
  isApiError,
  isApiLikeError,
  isNetworkFetchError,
  toApiErrorFromApiLike,
} from '@/errors/error-type-guards';

export function formatToApiError(error: unknown): ApiError | null {
  if (isApiError(error)) return error;

  if (isAbortError(error)) {
    return new ApiError('Request timeout', 0, 'Request Timeout', undefined);
  }

  if (isNetworkFetchError(error)) {
    return new ApiError(
      'Network connection error',
      0,
      'Network Error',
      undefined,
    );
  }

  if (isApiLikeError(error)) {
    return toApiErrorFromApiLike(error);
  }

  console.debug('Unknown error format:', error);
  return null;
}
