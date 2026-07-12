import { ApiError } from '@/api/errors';

interface ApiLikeError {
  status: number;
  statusText: string;
  data?: unknown;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isAbortError(error: unknown): error is DOMException {
  if (error instanceof DOMException) {
    return error.name === 'AbortError';
  }

  return false;
}

export function isNetworkFetchError(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;

  const msg = (error.message ?? '').toLowerCase();

  return (
    // Chrome fetch error
    msg.includes('failed to fetch') ||
    // Firefox fetch error
    msg.includes('networkerror') ||
    // Safari fetch error
    msg.includes('load failed')
  );
}

export function isApiLikeError(error: unknown): error is ApiLikeError {
  if (!isNonNullObject(error)) return false;

  return (
    typeof error.status === 'number' &&
    Number.isFinite(error.status) &&
    typeof error.statusText === 'string'
  );
}
export function isNonNullObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function toApiErrorFromApiLike(error: ApiLikeError): ApiError {
  const statusText = error.statusText?.trim() ?? 'API Error';
  return new ApiError(statusText, error.status, statusText, error.data);
}
