import { useTranslation } from 'react-i18next';

import { KosmosLogo } from '@/app/components/brand/kosmos-logo';
import { SignInButton, useAuth } from '@/auth';
import { Button } from '@/components/ui/button';

import type { AuthState } from '@/auth';
import type { Translations } from '@/types/i18n';

type UnauthenticatedStatus = Exclude<AuthState['status'], 'authenticated'>;

interface UnauthenticatedLandingProps {
  status: UnauthenticatedStatus;
}

export function UnauthenticatedLanding({
  status,
}: UnauthenticatedLandingProps): React.JSX.Element {
  const { t } = useTranslation();
  const auth = useAuth();

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f8f7f3_0%,#ffffff_44%,#eef3ef_100%)] text-foreground">
      <div className="mx-auto grid min-h-screen w-full max-w-5xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-7">
          <KosmosLogo
            className="flex items-center gap-3 text-2xl font-semibold tracking-tight"
            markClassName="size-11"
          />
          <div className="w-fit border border-border bg-background/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {t('auth.landing.badge')}
          </div>
          <div className="max-w-2xl space-y-4">
            <h1 className="text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
              {t('auth.landing.title')}
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground">
              {t('auth.landing.subtitle')}
            </p>
          </div>
        </section>
        <section className="border border-border bg-background/90 p-6 shadow-sm">
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">
                {t('auth.landing.access.title')}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t(getLandingMessageKey(status))}
              </p>
            </div>
            <div className="min-h-11">
              {status === 'restoring' ? (
                <div className="h-2 w-full overflow-hidden bg-muted">
                  <div className="h-full w-1/3 animate-pulse bg-primary" />
                </div>
              ) : null}
              {status === 'anonymous' || status === 'error' ? (
                <SignInButton />
              ) : null}
              {status === 'forbidden' ? (
                <Button
                  onClick={() => auth.signOut()}
                  type="button"
                  variant="outline"
                >
                  {t('auth.landing.action.tryAnotherAccount')}
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function getLandingMessageKey(
  status: UnauthenticatedStatus,
): keyof Translations {
  if (status === 'restoring') {
    return 'auth.landing.status.checking';
  }

  if (status === 'forbidden') {
    return 'auth.landing.status.forbidden';
  }

  if (status === 'error') {
    return 'auth.landing.status.error';
  }

  return 'auth.landing.status.signIn';
}
