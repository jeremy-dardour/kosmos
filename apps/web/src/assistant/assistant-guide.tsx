import { useAgoContext } from '@useago/sdk/react';

import { KOSMOS_GUIDE } from '@/assistant/context/kosmos-guide';

import type { ContextEntry } from '@useago/sdk';

const GUIDE_ENTRY: ContextEntry = {
  name: 'Kosmos guide',
  description:
    'How Kosmos works, what a good pipeline looks like, and what the assistant must not do.',
  data: { guide: KOSMOS_GUIDE },
  stable: true,
};

export const AssistantGuide = () => {
  useAgoContext(GUIDE_ENTRY, 'kosmos-guide');

  return null;
};
