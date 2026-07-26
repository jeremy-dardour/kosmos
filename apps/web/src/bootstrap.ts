import { setApiClient } from '@/api/api-client';
import { configureApiClient } from '@/api/configure-api-client';
import { createAuth } from '@/auth';

export function bootstrap() {
  const auth = createAuth();
  const apiClient = configureApiClient(auth.provider);
  setApiClient(apiClient);

  return { auth };
}
