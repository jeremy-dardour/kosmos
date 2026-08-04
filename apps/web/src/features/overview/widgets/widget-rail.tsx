import { PanelRightIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface WidgetRailProperties {
  isPanelOpen: boolean;
  onTogglePanel: () => void;
}

/**
 * The always-visible outer strip. It holds one toggle today but is a list so
 * further widget entry points can join it without changing the shape.
 */
export const WidgetRail = ({
  isPanelOpen,
  onTogglePanel,
}: WidgetRailProperties) => {
  const { t } = useTranslation();

  const toggleLabel = t(
    isPanelOpen ? 'overview.widgets.hidePanel' : 'overview.widgets.showPanel',
  );

  return (
    <nav
      aria-label={t('overview.widgets.railLabel')}
      className="flex w-11 shrink-0 flex-col items-center border-l bg-background pt-3"
    >
      <ul className="flex flex-col items-center gap-1">
        <li>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={toggleLabel}
                  aria-pressed={isPanelOpen}
                  onClick={onTogglePanel}
                  className={
                    isPanelOpen
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground'
                  }
                />
              }
            >
              <PanelRightIcon />
            </TooltipTrigger>
            <TooltipContent side="left">{toggleLabel}</TooltipContent>
          </Tooltip>
        </li>
      </ul>
    </nav>
  );
};
