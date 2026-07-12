import { createContext } from 'react';

import type { ApiError } from '@/api/errors';

interface Props {
  error: null | ApiError;
  showError: (error: unknown) => void;
  clearError: () => void;
}

export const ApiErrorContext = createContext<Props | undefined>(undefined);
