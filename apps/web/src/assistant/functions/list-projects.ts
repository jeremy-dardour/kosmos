import { fetchProjects } from '@/api/hooks/use-projects';

import type { QueryClient } from '@tanstack/react-query';
import type { ClientFunctionDefinition } from '@useago/sdk';

// Static shape lives at module scope so its `parameters` reference is stable
// across renders — useAgoFunction re-registers when that reference changes.
const definition: Omit<ClientFunctionDefinition, 'handler'> = {
  name: 'listProjects',
  description:
    "List the projects the current user belongs to, with each project's id and name. Use an id to navigate to that project's overview.",
  parameters: { type: 'object', properties: {} },
};

export const listProjectsFunction = (
  queryClient: QueryClient,
): ClientFunctionDefinition => ({
  ...definition,
  handler: async () => {
    const projects = await fetchProjects(queryClient);
    return projects
      .filter((project) => !project.deletedAt)
      .map(({ id, name, eventDate }) => ({ id, name, eventDate }));
  },
});
