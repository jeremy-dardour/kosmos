import type { UserSummary } from '@/api/hooks/use-overview';
import type { Member } from '@/api/hooks/use-project-members';

/**
 * A directory entry pairs the overview's owner-reference data with the
 * members query's membership fact. `isMember: false` marks an ex-member whose
 * assignments survived their removal.
 */
export type DirectoryUser = UserSummary & { isMember: boolean };

/**
 * The one derived lookup the page passes down. While the members query is
 * still loading, everyone counts as a member so the ex-member style cannot
 * flash on a fresh page.
 */
export function buildUsersById(
  users: readonly UserSummary[] | undefined,
  members: readonly Member[] | undefined,
): Map<string, DirectoryUser> {
  const memberUserIds = members && new Set(members.map((m) => m.userId));

  return new Map(
    (users ?? []).map((user) => [
      user.id,
      { ...user, isMember: memberUserIds?.has(user.id) ?? true },
    ]),
  );
}

/** Owner pickers offer joined members only — the API rejects non-members. */
export function toAssignableUsers(
  members: readonly Member[] | undefined,
): UserSummary[] {
  return (members ?? [])
    .filter((member) => member.userId != null)
    .map((member) => ({
      id: member.userId!,
      name: member.name ?? member.email,
      avatarUrl: member.avatarUrl ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
