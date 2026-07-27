import { setApiClient } from '@/api/api-client';
import { configureApiClient } from '@/api/configure-api-client';
import { createAuthSystem } from '@/auth';

export function bootstrap() {
  const authSystem = createAuthSystem();
  setApiClient(configureApiClient(authSystem.session));

  return { authSystem };
}
