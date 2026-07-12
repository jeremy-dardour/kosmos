import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ApiError } from '@/api/errors';
import { ApiErrorProvider } from '@/errors/api-error-provider';
import { useApiError } from '@/errors/use-api-error';

describe('useApiError', () => {
  it('should throw error when used outside an ApiErrorProvider', () => {
    expect(() => {
      renderHook(() => useApiError());
    }).toThrow('useApiError must be used within an ApiErrorProvider');
  });

  it('should return error context when used within an ApiErrorProvider', () => {
    const { result } = renderHookWithProvider();

    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('showError');
    expect(result.current).toHaveProperty('clearError');
  });

  describe('errorContext', () => {
    it('should init with null error', () => {
      const { result } = renderHookWithProvider();

      expect(result.current.error).toBeNull();
    });

    it('should set error when showError is called with ApiError', () => {
      const { result } = renderHookWithProvider();
      const apiError = new ApiError('API Error', 400, 'Bad Request');

      act(() => {
        result.current.showError(apiError);
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe('API Error');
    });

    it('should ignore non-API errors', () => {
      const { result } = renderHookWithProvider();

      act(() => {
        result.current.showError(new Error('Generic error'));
      });

      expect(result.current.error).toBeNull();
    });

    it('should clear error when clearError is called', () => {
      const { result } = renderHookWithProvider();

      act(() => {
        result.current.showError(
          new ApiError('API Error', 500, 'Internal Server Error'),
        );
      });
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it('should show only last API error when several errors', () => {
      const { result } = renderHookWithProvider();

      act(() => {
        result.current.showError(
          new ApiError('First error', 400, 'Bad Request'),
        );
      });
      act(() => {
        result.current.showError(
          new ApiError('Second error', 404, 'Not Found'),
        );
      });

      expect(result.current.error?.message).toBe('Second error');
    });

    it('should not replace API error with non-API error', () => {
      const { result } = renderHookWithProvider();

      act(() => {
        result.current.showError(
          new ApiError('API Error', 500, 'Server Error'),
        );
      });
      act(() => {
        result.current.showError(new Error('Generic error'));
      });

      expect(result.current.error?.message).toBe('API Error');
    });
  });
});

const renderHookWithProvider = () =>
  renderHook(() => useApiError(), {
    wrapper: ApiErrorProvider,
  });
