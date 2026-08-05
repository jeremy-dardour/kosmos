import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { OwnerAvatar } from '@/features/overview/owner-avatar';
import { cn } from '@/lib/utils';

import type { UserSummary } from '@/api/hooks/use-overview';

/** The radio group needs a string for "no explicit owner". */
const NO_OWNER = '';

interface OwnerPickerProperties {
  /** Joined members — the options an owner can be set to. */
  users: UserSummary[];
  /**
   * The current owner, resolved by the caller from the users directory — an
   * ex-member owner is displayable even though they are no longer an option.
   */
  owner: (UserSummary & { isMember?: boolean }) | null;
  /** Accessible name for the trigger. */
  label: string;
  /** Copy for the clearing option — "Unassigned" or "Inherit workstream owner". */
  clearLabel: string;
  className?: string;
  onSelect: (ownerId: string | null) => void;
}

export const OwnerPicker = ({
  users,
  owner,
  label,
  clearLabel,
  className,
  onSelect,
}: OwnerPickerProperties) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={label}
            title={label}
            className={cn(
              'shrink-0 cursor-pointer rounded-full ring-offset-2 hover:opacity-80 focus-visible:ring-2',
              className,
            )}
          />
        }
      >
        <OwnerAvatar owner={owner} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={owner?.id ?? NO_OWNER}
          onValueChange={(value) =>
            onSelect(value === NO_OWNER ? null : String(value))
          }
        >
          <DropdownMenuRadioItem value={NO_OWNER}>
            {clearLabel}
          </DropdownMenuRadioItem>
          {users.map((user) => (
            <DropdownMenuRadioItem key={user.id} value={user.id}>
              {user.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
