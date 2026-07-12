import { setApiClient } from '@/api/api-client';
import { configureApiClient } from '@/api/configure-api-client';
import { createAuthProvider } from '@/auth';

export function bootstrap() {
  const authProvider = createAuthProvider();
  const apiClient = configureApiClient(authProvider);
  setApiClient(apiClient);

  return { authProvider };
}
