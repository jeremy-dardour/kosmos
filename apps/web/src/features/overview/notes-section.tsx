import { useTranslation } from 'react-i18next';

import { useWorkstreamNotes } from '@/api/hooks/use-workstream-notes';
import { cn } from '@/lib/utils';

interface NotesSectionProperties {
  workstreamId: string;
}

function authorInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.at(0)?.toUpperCase() ?? '')
    .join('');
}

const URL_REGEX = /https?:\/\/[^\s<>)"]+/g;
const TRAILING_PUNCT = /[.,;:!?]+$/;

function trimUrl(raw: string): { href: string; trailing: string } {
  const match = TRAILING_PUNCT.exec(raw);
  if (!match) return { href: raw, trailing: '' };
  return { href: raw.slice(0, match.index), trailing: match[0] };
}

function NoteContent({ text }: { text: string }) {
  const parts = text.split(URL_REGEX);
  const rawUrls = text.match(URL_REGEX);

  if (!rawUrls) return <>{text}</>;

  return (
    <>
      {parts.map((part, i) => {
        const raw = rawUrls.at(i);
        const url = raw ? trimUrl(raw) : null;
        return (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- stable split output
          <span key={i}>
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

export const NotesSection = ({ workstreamId }: NotesSectionProperties) => {
  const { t } = useTranslation();
  const { data: notes, isPending, isError } = useWorkstreamNotes(workstreamId);

  return (
    <div>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t('overview.detail.notes')}
      </p>

      {isError && (
        <p className="text-xs text-destructive">
          {t('overview.detail.notesError')}
        </p>
      )}

      {isPending && (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="mb-1 h-3 w-24 rounded bg-muted" />
              <div className="h-4 w-full rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {notes?.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {t('overview.detail.notesEmpty')}
        </p>
      )}

      {notes && notes.length > 0 && (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id}>
              <p className="text-[11px] text-muted-foreground">
                {new Date(note.createdAt).toLocaleDateString()}
                <span className="mx-1">·</span>
                <span
                  className={cn(
                    'font-medium',
                    note.author ? 'text-foreground' : 'italic',
                  )}
                >
                  {note.author
                    ? authorInitials(note.author.name)
                    : t('overview.detail.unknownAuthor')}
                </span>
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm">
                <NoteContent text={note.content} />
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
