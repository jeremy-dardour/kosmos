import React, { useState, useCallback } from 'react';

import { ApiErrorContext } from '@/errors/api-error-context';
import { formatToApiError } from '@/errors/format-error';

import type { ApiError } from '@/api/errors';

interface Props {
  children: React.ReactNode;
}

export const ApiErrorProvider = ({ children }: Props) => {
  const [error, setError] = useState<ApiError | null>(null);

  const showError = useCallback((rawError: unknown) => {
    const formattedError = formatToApiError(rawError);
    if (formattedError !== null) {
      setError(formattedError);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <ApiErrorContext
      value={{
        error,
        showError,
        clearError,
      }}
    >
      {children}
    </ApiErrorContext>
  );
};
