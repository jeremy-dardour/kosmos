import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

import type { GoogleAuthProvider } from '@/auth/google-auth-provider';

interface GoogleSignInButtonProps {
  provider: GoogleAuthProvider;
}

/**
 * Hosts Google's own sign-in widget, and falls back to a plain button when it
 * cannot be rendered.
 *
 * - Takes the concrete `GoogleAuthProvider` rather than reading `useAuth()`:
 *   rendering a provider-owned widget is not part of the `AuthProvider`
 *   interface, and only the factory that built this provider can supply it.
 * - The cleanup returned by `renderSignInButton` is scoped to the node that
 *   call created, so running a stale one removes only that call's button — not
 *   whichever button is currently live.
 */
export function GoogleSignInButton({
  provider,
}: GoogleSignInButtonProps): React.JSX.Element {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState(false);

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
  }, [provider]);

  if (renderError) {
    return (
      <Button
        onClick={() => {
          setRenderError(false);
          void provider.signIn().catch(() => {
            setRenderError(true);
          });
        }}
        type="button"
      >
        {t('auth.landing.action.signInWithGoogle')}
      </Button>
    );
  }

  return <div ref={containerRef} className="min-h-10" />;
}
