import { useAgoFunction } from '@useago/sdk/react';
import { useNavigate } from 'react-router';

import { navigateToPageFunction } from '@/assistant/functions/navigate-to-page';

export const AssistantNavigation = () => {
  const navigate = useNavigate();

  useAgoFunction(
    navigateToPageFunction((path) => {
      void navigate(path);
    }),
  );

  return null;
};
