import { useAuth } from '@/auth/auth-context';
import { FakeSignInButton } from '@/auth/fake-sign-in-button';
import { GoogleAuthProvider } from '@/auth/google-auth-provider';
import { GoogleSignInButton } from '@/auth/google-sign-in-button';

/**
 * Google must render its own iframe button: a plain button wired to `signIn()`
 * goes through One Tap, which browsers suppress unpredictably (ADR 0007).
 */
export function SignInButton(): React.JSX.Element {
  const session = useAuth();

  if (session instanceof GoogleAuthProvider) {
    return <GoogleSignInButton provider={session} />;
  }

  return <FakeSignInButton />;
}
