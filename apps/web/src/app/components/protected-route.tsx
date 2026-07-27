import { UnauthenticatedLanding } from '@/app/components/unauthenticated-landing';
import { useAuthState } from '@/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({
  children,
}: ProtectedRouteProps): React.JSX.Element {
  const state = useAuthState();

  if (state.status === 'authenticated') {
    return <>{children}</>;
  }

  return <UnauthenticatedLanding status={state.status} />;
}
