import {
  useAgoNavigation,
  useAgoAutoContinueAfterNavigation,
} from '@useago/sdk/react';
import { useNavigate } from 'react-router';

import { NAVIGABLE_ROUTES } from '@/app/nav-routes';

export const AssistantNavigation = () => {
  const navigate = useNavigate();
  useAgoNavigation((path) => {
    void navigate(path);
  }, NAVIGABLE_ROUTES);
  useAgoAutoContinueAfterNavigation();

  return null;
};
