import { PencilIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { HOVER_REVEAL } from '@/features/overview/hover-reveal';
import { cn } from '@/lib/utils';

import type { StepThread } from '@/features/overview/use-step-notes';

const URL_REGEX = /https?:\/\/[^\s<>)"]+/g;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

function splitTrailingPunctuation(raw: string): {
  href: string;
  trailing: string;
} {
  const match = TRAILING_PUNCTUATION.exec(raw);
  if (!match) return { href: raw, trailing: '' };

  return { href: raw.slice(0, match.index), trailing: match[0] };
}

/** URLs in a note render as links — there is no separate Link entity. */
function NoteBody({ text }: { text: string }) {
  const parts = text.split(URL_REGEX);
  const rawUrls = text.match(URL_REGEX);

  if (!rawUrls) return <>{text}</>;

  return (
    <>
      {parts.map((part, index) => {
        const raw = rawUrls.at(index);
        const url = raw ? splitTrailingPunctuation(raw) : null;

        return (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- stable split output
          <span key={index}>
            {part}
            {url && (
              <>
                <a
                  href={url.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-step-in-progress underline underline-offset-2 hover:text-step-in-progress/80"
                >
                  {url.href}
                </a>
                {url.trailing}
              </>
            )}
          </span>
        );
      })}
    </>
  );
}

interface NoteThreadProperties {
  /** Names the step in the composer and entry-control labels. */
  stepName: string;
  thread: StepThread;
  /** A frozen Step still accepts new notes, but its entries cannot change. */
  isAppendOnly: boolean;
  onEscape?: () => void;
}

/**
 * The entries of one Step's note log plus its composer, shared by the step
 * editor and the standalone note panel so both obey the same authorship rules.
 */
export const NoteThread = ({
  stepName,
  thread,
  isAppendOnly,
  onEscape,
}: NoteThreadProperties) => {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="mt-1.5 space-y-1">
      {thread.isPending && (
        <p className="text-[11px] text-muted-foreground">
          {t('overview.notes.loading')}
        </p>
      )}
      {thread.isError && (
        <p className="text-[11px] text-destructive">
          {t('overview.thread.loadError')}
        </p>
      )}

      {thread.entries.map((entry) => (
        <div
          key={entry.id}
          className="group/note rounded bg-muted/35 px-2 py-1 text-[11px] leading-snug"
        >
          <div className="flex items-center gap-1.5">
            <span className="font-medium">{entry.author}</span>
            <span className="text-muted-foreground/70">{entry.when}</span>
            {entry.isOwn && !isAppendOnly && editingId !== entry.id && (
              <span
                className={cn(
                  HOVER_REVEAL,
                  'ml-auto flex items-center gap-1 group-focus-within/note:opacity-100 group-hover/note:opacity-100',
                )}
              >
                <button
                  type="button"
                  aria-label={t('overview.notes.editNote', { name: stepName })}
                  title={t('overview.notes.editNote', { name: stepName })}
                  onClick={() => setEditingId(entry.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <PencilIcon aria-hidden className="size-3" />
                </button>
                <button
                  type="button"
                  aria-label={t('overview.notes.deleteNote', {
                    name: stepName,
                  })}
                  title={t('overview.notes.deleteNote', { name: stepName })}
                  onClick={() => thread.deleteNote(entry.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Trash2Icon aria-hidden className="size-3" />
                </button>
              </span>
            )}
          </div>

          {editingId === entry.id ? (
            <input
              // eslint-disable-next-line jsx-a11y/no-autofocus -- the click already moved focus here
              autoFocus
              aria-label={t('overview.notes.editInput', { name: stepName })}
              defaultValue={entry.body}
              className="mt-1 h-6 w-full rounded border bg-background px-1.5 text-[11px]"
              onBlur={() => setEditingId(null)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setEditingId(null);
                  return;
                }
                if (event.key !== 'Enter') return;

                const body = event.currentTarget.value.trim();
                if (body && body !== entry.body) {
                  thread.editNote(entry.id, body);
                }
                setEditingId(null);
              }}
            />
          ) : (
            <p className="mt-0.5 whitespace-pre-wrap">
              <NoteBody text={entry.body} />
            </p>
          )}
        </div>
      ))}

      <input
        aria-label={t('overview.notes.addToStep', { name: stepName })}
        placeholder={t('overview.thread.composerPlaceholder')}
        maxLength={5000}
        className="h-7 w-full rounded-md border bg-background px-2 text-[11px]"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onEscape?.();
          if (event.key !== 'Enter') return;

          const body = event.currentTarget.value.trim();
          if (!body) return;

          thread.addNote(body);
          event.currentTarget.value = '';
        }}
      />

      {thread.errorDetail && (
        <p role="alert" className="text-[11px] text-destructive">
          {thread.errorDetail}
        </p>
      )}
    </div>
  );
};
