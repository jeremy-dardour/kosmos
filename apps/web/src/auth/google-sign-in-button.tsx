import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

import type { GoogleAuthProvider } from '@/auth/google-auth-provider';

interface GoogleSignInButtonProps {
  provider: GoogleAuthProvider;
}

/**
 * Bound to its concrete provider once by `createAuthSystem`; consumers render
 * the provider-agnostic `SignInButton` from context (ADR 0007).
 */
export function GoogleSignInButton({
  provider,
}: GoogleSignInButtonProps): React.JSX.Element {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState(false);
  const [renderAttempt, setRenderAttempt] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let cleanup: (() => void) | undefined;
    let isMounted = true;

    void provider
      .renderSignInButton(container)
      .then((nextCleanup) => {
        if (isMounted) {
          cleanup = nextCleanup;
        } else {
          nextCleanup();
        }
      })
      .catch(() => {
        if (isMounted) {
          setRenderError(true);
        }
      });

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [provider, renderAttempt]);

  if (renderError) {
    return (
      <Button
        onClick={() => {
          setRenderError(false);
          setRenderAttempt((attempt) => attempt + 1);
        }}
        type="button"
      >
        {t('auth.landing.action.signInWithGoogle')}
      </Button>
    );
  }

  return <div ref={containerRef} className="min-h-10" />;
}
