import { MessageCircleIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { KosmosLogo } from '@/app/components/brand/kosmos-logo';
import { UserMenu } from '@/app/components/layout/user-menu';
import { Button } from '@/components/ui/button';

interface LayoutHeaderProperties {
  isAssistantOpen?: boolean;
  /** Omitted when the assistant is unconfigured — the toggle is then absent. */
  onToggleAssistant?: () => void;
}

export const LayoutHeader = ({
  isAssistantOpen = false,
  onToggleAssistant,
}: LayoutHeaderProperties) => {
  const { t } = useTranslation();

  const assistantLabel = t(
    isAssistantOpen ? 'app.assistant.hide' : 'app.assistant.show',
  );

  return (
    <header className="flex items-center justify-between border-b bg-background px-4 py-2">
      <Link
        to="/"
        aria-label={t('app.logo.homeLink')}
        className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <KosmosLogo className="flex items-center gap-2.5 text-lg font-semibold tracking-tight" />
      </Link>
      <div className="flex items-center gap-1">
        {onToggleAssistant && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={assistantLabel}
            aria-pressed={isAssistantOpen}
            onClick={onToggleAssistant}
            className={
              isAssistantOpen
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground'
            }
          >
            <MessageCircleIcon />
          </Button>
        )}
        <UserMenu />
      </div>
    </header>
  );
};
