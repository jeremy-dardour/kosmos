import { EventCountdown } from '@/features/overview/event-countdown';

import type { Project } from '@/api/hooks/use-overview';

interface OverviewHeaderProperties {
  project: Project;
}

export const OverviewHeader = ({ project }: OverviewHeaderProperties) => {
  return (
    <header className="mb-3 flex items-center gap-3">
      <h1 className="truncate text-[15px] font-semibold">{project.name}</h1>
      <EventCountdown eventDate={project.eventDate} />
    </header>
  );
};
