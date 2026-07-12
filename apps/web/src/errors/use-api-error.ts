import { useContext } from 'react';

import { ApiErrorContext } from './api-error-context';

export function useApiError() {
  const context = useContext(ApiErrorContext);

  if (context === undefined) {
    throw new Error('useApiError must be used within an ApiErrorProvider');
  }

  return context;
}
