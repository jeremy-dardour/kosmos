import { fetchProjectMembers } from '@/api/hooks/use-project-members';

import type { QueryClient } from '@tanstack/react-query';
import type { ClientFunctionDefinition } from '@useago/sdk';

// Static shape lives at module scope so its `parameters` reference is stable
// across renders — useAgoFunction re-registers when that reference changes.
const definition: Omit<ClientFunctionDefinition, 'handler'> = {
  name: 'listMembers',
  description:
    "List the members of the project currently being viewed, with each member's name, email, and whether they own the project. Pending invitations (no name yet) are included.",
  parameters: { type: 'object', properties: {} },
};

/**
 * Bound to the overview's project id: the agent lists the members of whichever
 * project is on screen, so no project argument is needed.
 */
export const listMembersFunction = (
  queryClient: QueryClient,
  projectId: string,
): ClientFunctionDefinition => ({
  ...definition,
  handler: async () => {
    const members = await fetchProjectMembers(queryClient, projectId);
    return members.map(({ name, email, isOwner }) => ({
      name,
      email,
      isOwner,
    }));
  },
});
