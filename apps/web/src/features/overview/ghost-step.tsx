import { XIcon } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

/**
 * The unsaved step a clicked insert point opens. It has no server row yet, so
 * the only field it offers is its name: committing a non-empty one creates the
 * step, an empty one throws the ghost away (handoff §6.2).
 */
export interface GhostStepDraft {
  /** The card the ghost belongs to. */
  workstreamId: string;
  /** Survives a rejected create, so typed input is never lost. */
  name: string;
  isPending: boolean;
  onCommit: (name: string) => void;
  onDiscard: () => void;
}

interface GhostStepProperties {
  ghost: GhostStepDraft;
}

export const GhostStep = ({ ghost }: GhostStepProperties) => {
  const { t } = useTranslation();
  const isDiscardedRef = useRef(false);

  const discard = () => {
    isDiscardedRef.current = true;
    ghost.onDiscard();
  };

  return (
    <section
      aria-label={t('overview.ghostStep.panelLabel')}
      className="mt-2 rounded-lg border border-dashed border-step-in-progress/40 bg-step-in-progress/5 p-2.5"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-3 shrink-0 rounded-full border-[1.5px] border-dashed border-step-not-started"
        />
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus -- an insert point opens straight into the name (A8)
          autoFocus
          aria-label={t('overview.ghostStep.nameLabel')}
          defaultValue={ghost.name}
          placeholder={t('overview.stepEditor.namePlaceholder')}
          className="min-w-0 flex-1 rounded border bg-background px-1 text-xs font-medium outline-hidden ring-2 ring-step-in-progress/40"
          onBlur={(event) => {
            if (isDiscardedRef.current || ghost.isPending) return;
            ghost.onCommit(event.target.value.trim());
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            } else if (event.key === 'Escape') {
              discard();
            }
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t('overview.ghostStep.discard')}
          title={t('overview.ghostStep.discard')}
          // The name field commits on blur, so the intent to throw it away has
          // to be recorded before the click moves focus off it.
          onPointerDown={() => {
            isDiscardedRef.current = true;
          }}
          onClick={discard}
        >
          <XIcon />
        </Button>
      </div>

      <p className="mt-1 text-[11px] text-muted-foreground/70">
        {t('overview.stepEditor.notesUnavailable')}
      </p>
    </section>
  );
};
