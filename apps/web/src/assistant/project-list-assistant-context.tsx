import { useAgoContext } from '@useago/sdk/react';

import { useProjects } from '@/api/hooks/use-projects';
import { buildProjectsContext } from '@/assistant/context/build-projects-context';

/**
 * The project list's page-scoped context. Mounted only while the list is on
 * screen, so it registers on arrival and unregisters on navigation away, and
 * subscribes to the query the page already holds warm rather than fetching.
 */
export const ProjectListAssistantContext = () => {
  const projects = useProjects();

  useAgoContext(() => buildProjectsContext(projects.data), 'projects');

  return null;
};
