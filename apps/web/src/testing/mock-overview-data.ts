import { STUB_USER } from '@/testing/stub-auth';

import type {
  ChecklistItem,
  Group,
  Project,
  Step,
  UserSummary,
  Workstream,
} from '@/api/hooks/use-overview';
import type { NoteEntry } from '@/api/hooks/use-workstream-notes';

const TS = '2026-07-01T00:00:00.000Z';

/** Owned by the stub session user by default — override `ownerId` for a shared project. */
export function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Our Wedding',
    eventDate: '2027-06-15',
    ownerId: STUB_USER.id,
    deletedAt: null,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  };
}

export function user(overrides: Partial<UserSummary> = {}): UserSummary {
  return {
    id: 'u1',
    name: 'Alice Doe',
    avatarUrl: null,
    ...overrides,
  };
}

export function group(overrides: Partial<Group> = {}): Group {
  return {
    id: 'g1',
    position: 0,
    name: 'Venue & Catering',
    color: '#5a9e6f',
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  };
}

export function step(
  name: string,
  status: Step['status'],
  overrides: Partial<Step> = {},
): Step {
  return {
    id: `step-${name}`,
    name,
    position: 1,
    status,
    blocked: false,
    deadline: null,
    outcome: null,
    outcomeAt: null,
    explicitOwnerId: null,
    effectiveOwnerId: null,
    checklistItems: [],
    noteCount: 0,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  };
}

export function checklistItem(
  name: string,
  isDone: boolean,
  overrides: Partial<ChecklistItem> = {},
): ChecklistItem {
  return {
    id: `cl-${name}`,
    name,
    position: 1,
    done: isDone,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  };
}

export function workstream(overrides: Partial<Workstream> = {}): Workstream {
  return {
    id: 'w1',
    position: 0,
    name: 'Catering',
    icon: '🍽️',
    groupId: null,
    lifecycle: 'active',
    ownerId: null,
    currentStepId: null,
    startedAt: null,
    completedAt: null,
    steps: [step('Request quotes', 'in_progress')],
    nearestDeadlineStepId: null,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  };
}

export function note(overrides: Partial<NoteEntry> = {}): NoteEntry {
  return {
    id: 'n1',
    stepId: 'step-1',
    content: 'Called the caterer, they can do June.',
    author: { id: 'u1', name: 'Alice Doe', avatarUrl: null },
    createdAt: '2026-07-10T14:00:00.000Z',
    updatedAt: '2026-07-10T14:00:00.000Z',
    ...overrides,
  };
}
