import { useRef, useState } from 'react';

import { cn } from '@/lib/utils';

interface ClickToEditProperties {
  value: string;
  /** Accessible name for both the trigger and the input. */
  label: string;
  placeholder: string;
  className?: string;
  /** A freshly created step opens straight into its name field. */
  startEditing?: boolean;
  onCommit: (next: string) => void;
}

/**
 * A text value that becomes an input in place. Enter and blur commit, Escape
 * cancels. An unchanged value never commits — the save model writes on blur,
 * so a redundant commit would be a redundant request.
 */
export const ClickToEdit = ({
  value,
  label,
  placeholder,
  className,
  startEditing = false,
  onCommit,
}: ClickToEditProperties) => {
  const [isEditing, setIsEditing] = useState(startEditing);
  const isCancelledRef = useRef(false);

  if (!isEditing) {
    return (
      <button
        type="button"
        aria-label={label}
        onClick={() => setIsEditing(true)}
        className={cn(
          '-mx-1 min-w-0 truncate rounded px-1 text-left hover:bg-muted focus-visible:bg-muted',
          !value && 'text-muted-foreground',
          className,
        )}
      >
        {value || placeholder}
      </button>
    );
  }

  return (
    <input
      // eslint-disable-next-line jsx-a11y/no-autofocus -- the click already moved focus here
      autoFocus
      aria-label={label}
      defaultValue={value}
      placeholder={placeholder}
      className={cn(
        '-mx-1 min-w-0 rounded border bg-background px-1 outline-hidden ring-2 ring-step-in-progress/40',
        className,
      )}
      onBlur={(event) => {
        if (!isCancelledRef.current && event.target.value !== value) {
          onCommit(event.target.value);
        }

        isCancelledRef.current = false;
        setIsEditing(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        } else if (event.key === 'Escape') {
          isCancelledRef.current = true;
          event.currentTarget.blur();
        }
      }}
    />
  );
};
