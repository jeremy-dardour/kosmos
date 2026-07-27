import { createElement } from 'react';

import { useAuthSystem } from '@/auth/auth-context';

export function SignInButton(): React.JSX.Element {
  const authSystem = useAuthSystem();

  return createElement(authSystem.SignInButton);
}
