import { daysUntil } from '@/features/overview/days-until';

import type { Group, Project } from '@/api/hooks/use-overview';
import type { Member } from '@/api/hooks/use-project-members';
import type { ContextEntry } from '@useago/sdk';

export interface ProjectContextInput {
  project: Project;
  members: readonly Member[] | undefined;
  groups: readonly Group[];
  today: Date;
}

const toIsoDay = (date: Date): string =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

const toMemberLine = (member: Member): string =>
  `${member.userId!} ${member.name ?? member.email}${member.isOwner ? ' (owner)' : ''}`;

const toGroupLine = (group: Group): string => `${group.id} ${group.name}`;

export function buildProjectContext({
  project,
  members,
  groups,
  today,
}: ProjectContextInput): ContextEntry {
  // Pending invitations have no user id yet and the API rejects them as
  // owners, so they are not offered here.
  const joined = (members ?? []).filter((member) => member.userId != null);

  return {
    name: 'Current project',
    description:
      'The project whose overview is on screen. Member lines lead with the user id to pass as an owner id, group lines with the group id. Dates are calendar days (YYYY-MM-DD); trust `today` over your own sense of the date.',
    data: {
      id: project.id,
      name: project.name,
      today: toIsoDay(today),
      eventDate: project.eventDate ?? 'no event date',
      ...(project.eventDate && {
        daysUntilEvent: daysUntil(project.eventDate, today),
      }),
      members:
        joined.length > 0
          ? joined.map((m) => toMemberLine(m)).join('\n')
          : 'no members',
      groups:
        groups.length > 0
          ? groups.map((g) => toGroupLine(g)).join('\n')
          : 'no groups',
    },
  };
}
