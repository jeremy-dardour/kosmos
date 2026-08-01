import { ChecklistItem } from '@/database/entities/checklist-item.entity';
import { Step } from '@/database/entities/step.entity';
import { User } from '@/database/entities/user.entity';
import { Workstream } from '@/database/entities/workstream.entity';

import type { StepOutcome } from '@/database/entities/step.entity';
import type { Collection } from '@mikro-orm/core';

/** Plain-array Collection, so entity graphs need no EntityManager. */
function stubCollection<T extends object>(items: T[]): Collection<T> {
  return {
    getItems: () => [...items],
    add(incoming: T | T[]) {
      const arr = Array.isArray(incoming) ? incoming : [incoming];
      items.push(...arr);
    },
    remove(toRemove: T | T[]) {
      const arr = Array.isArray(toRemove) ? toRemove : [toRemove];
      for (const item of arr) {
        const idx = items.indexOf(item);
        if (idx !== -1) items.splice(idx, 1);
      }
    },
  } as unknown as Collection<T>;
}

export function buildUser(id: string): User {
  const user = new User();
  user.id = id;
  user.name = `User ${id}`;
  user.email = `${id}@test.com`;
  user.avatarUrl = null;

  return user;
}

export function buildChecklistItem(
  id: string,
  name: string,
  position = 1,
): ChecklistItem {
  const item = new ChecklistItem();
  item.id = id;
  item.name = name;
  item.done = false;
  item.position = position;
  item.createdAt = new Date('2026-07-01');
  item.updatedAt = new Date('2026-07-01');

  return item;
}

export function buildStep(overrides: {
  id?: string;
  position: number;
  name?: string;
  deadline?: string | null;
  outcome?: StepOutcome | null;
  blocked?: boolean;
  checklistItems?: ChecklistItem[];
}): Step {
  const step = new Step();
  step.id = overrides.id ?? `step-${overrides.position}`;
  step.position = overrides.position;
  step.name = overrides.name ?? `Step ${overrides.position}`;
  step.deadline = overrides.deadline ?? null;
  step.outcome = overrides.outcome ?? null;
  step.blocked = overrides.blocked ?? false;
  step.owner = null;
  step.createdAt = new Date('2026-07-01');
  step.updatedAt = new Date('2026-07-01');
  const checklistItems = overrides.checklistItems ?? [];
  step.checklistItems = stubCollection(checklistItems);
  for (const item of checklistItems) {
    item.step = step;
  }

  return step;
}

export function buildWorkstream(overrides: {
  startedAt?: Date | null;
  completedAt?: Date | null;
  currentStep?: Step | null;
  steps: Step[];
  updatedAt?: Date;
}): Workstream {
  const workstream = new Workstream();
  workstream.id = 'ws-1';
  workstream.name = 'Test';
  workstream.icon = '🔧';
  workstream.startedAt = overrides.startedAt ?? null;
  workstream.completedAt = overrides.completedAt ?? null;
  workstream.currentStep = overrides.currentStep ?? null;
  workstream.updatedAt = overrides.updatedAt ?? new Date('2026-07-01');
  workstream.createdAt = new Date('2026-07-01');
  workstream.steps = stubCollection(overrides.steps);
  workstream.owner = null;
  workstream.group = null;

  return workstream;
}
