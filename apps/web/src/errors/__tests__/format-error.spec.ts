import { describe, expect, it } from 'vitest';

import { ApiError } from '@/api/errors';
import { formatToApiError } from '@/errors/format-error';

describe('formatToApiError', () => {
  it('should return ApiError as-is', () => {
    const error = new ApiError('API Error', 500, 'Internal Server Error');
    const formatted = formatToApiError(error);
    expect(formatted).toBe(error);
  });

  it('should convert AbortError to ApiError with 0 status', () => {
    const error = new DOMException('Aborted', 'AbortError');
    const formatted = formatToApiError(error);

    expect(formatted).toBeInstanceOf(ApiError);
    expect(formatted?.status).toBe(0);
    expect(formatted?.message).toBe('Request timeout');
  });

  it('should convert fetch TypeError to ApiError with 0 status', () => {
    // Use a message that matches isNetworkFetchError logic
    const error = new TypeError('Failed to fetch');
    const formatted = formatToApiError(error);

    expect(formatted).toBeInstanceOf(ApiError);
    expect(formatted?.status).toBe(0);
    expect(formatted?.message).toBe('Network connection error');
  });

  it('should convert API-like error objects to ApiError', () => {
    const error = {
      status: 404,
      statusText: 'Not Found',
      data: { detail: 'Resource not found' },
    };
    const formatted = formatToApiError(error);

    expect(formatted).toBeInstanceOf(ApiError);
    expect(formatted?.status).toBe(404);
    expect(formatted?.statusText).toBe('Not Found');
  });

  it('should return null for standard Error', () => {
    const error = new Error('Unknown error');
    const formatted = formatToApiError(error);
    expect(formatted).toBeNull();
  });

  it('should return null for unknown error types', () => {
    const formatted = formatToApiError('string error');
    expect(formatted).toBeNull();
  });
});
