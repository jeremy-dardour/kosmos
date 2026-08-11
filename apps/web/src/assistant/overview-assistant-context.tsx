import { useAgoContext } from '@useago/sdk/react';

import { useOverview } from '@/api/hooks/use-overview';
import { useProjectMembers } from '@/api/hooks/use-project-members';
import { buildProjectContext } from '@/assistant/context/build-project-context';
import { buildWorkstreamsContext } from '@/assistant/context/build-workstreams-context';

interface OverviewAssistantContextProperties {
  projectId: string;
}

/**
 * The overview's page-scoped context. Mounted only while the overview is on
 * screen, so it registers on arrival and unregisters on navigation away. It
 * subscribes to the queries the page already holds warm rather than fetching;
 * the providers are dynamic, re-evaluated at each send, which is what keeps
 * the assistant's view current after its own writes.
 */
export const OverviewAssistantContext = ({
  projectId,
}: OverviewAssistantContextProperties) => {
  const overview = useOverview(projectId);
  const members = useProjectMembers(projectId);

  useAgoContext(() => {
    if (!overview.data) return null;

    return buildProjectContext({
      project: overview.data.project,
      members: members.data,
      groups: overview.data.groups,
      today: new Date(),
    });
  }, 'project');

  useAgoContext(
    () => (overview.data ? buildWorkstreamsContext(overview.data) : null),
    'workstreams',
  );

  return null;
};
