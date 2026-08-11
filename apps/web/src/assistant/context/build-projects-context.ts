import type { Project } from '@/api/hooks/use-overview';
import type { ContextEntry } from '@useago/sdk';

const toLine = (project: Project): string =>
  [
    project.id,
    project.name,
    '·',
    project.eventDate ? `event ${project.eventDate}` : 'no event date',
  ].join(' ');

export function buildProjectsContext(
  projects: readonly Project[] | undefined,
): ContextEntry {
  const live = (projects ?? []).filter((project) => !project.deletedAt);

  return {
    name: 'Projects',
    description:
      'The projects the current user belongs to, one per line: <projectId> <name> · event date. Use the id to navigate to a project; authoring is only possible once its overview is on screen.',
    data: {
      projects:
        live.length > 0 ? live.map((p) => toLine(p)).join('\n') : 'no projects',
    },
  };
}
