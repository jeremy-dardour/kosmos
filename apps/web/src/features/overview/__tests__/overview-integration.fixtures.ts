import {
  group,
  project,
  step,
  user,
  workstream,
} from '@/testing/mock-overview-data';

import type { Overview } from '@/api/hooks/use-overview';

export const defaultOverview = {
  project: project(),
  groups: [group()],
  workstreams: [
    workstream({
      id: 'w-catering',
      name: 'Catering',
      icon: '🍽️',
      groupId: 'g1',
      ownerId: 'u1',
      steps: [
        step('Research options', 'done', { id: 's1', position: 1 }),
        step('Request quotes', 'in_progress', { id: 's2', position: 2 }),
        step('Book caterer', 'not_started', { id: 's3', position: 3 }),
      ],
    }),
    workstream({
      id: 'w-flowers',
      name: 'Flowers',
      icon: '💐',
      groupId: 'g1',
      lifecycle: 'not_started',
      steps: [step('Find florist', 'not_started', { id: 's4', position: 1 })],
    }),
    workstream({
      id: 'w-venue',
      name: 'Venue',
      icon: '🏰',
      groupId: null,
      lifecycle: 'complete',
      steps: [
        step('Visit venues', 'done', { id: 's5', position: 1 }),
        step('Sign contract', 'done', { id: 's6', position: 2 }),
      ],
    }),
  ],
  users: [user()],
} satisfies Overview;
