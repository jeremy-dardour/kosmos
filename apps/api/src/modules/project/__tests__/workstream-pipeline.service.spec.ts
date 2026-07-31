import { Collection } from '@mikro-orm/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChecklistItem } from '@/database/entities/checklist-item.entity';
import { Step, StepOutcome } from '@/database/entities/step.entity';
import { User } from '@/database/entities/user.entity';
import { Workstream } from '@/database/entities/workstream.entity';
import { WorkstreamService } from '@/modules/project/workstream.service';

import type { UpdatePipelineDto } from '@/modules/project/dtos/input/update-pipeline.dto';
import type { LockedWorkstreamChanges } from '@/modules/project/repositories/workstream.repository';

// --- Collection stub backed by a plain array (bypasses MikroORM internals) ---

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

// --- Entity builders ---

function buildUser(id: string): User {
  const u = new User();
  u.id = id;
  u.name = `User ${id}`;
  u.email = `${id}@test.com`;
  u.avatarUrl = null;
  return u;
}

function buildChecklistItem(id: string, name: string): ChecklistItem {
  const ci = new ChecklistItem();
  ci.id = id;
  ci.name = name;
  ci.done = false;
  ci.position = 1;
  ci.createdAt = new Date('2026-07-01');
  ci.updatedAt = new Date('2026-07-01');
  return ci;
}

function buildStep(overrides: {
  id?: string;
  position: number;
  name?: string;
  outcome?: StepOutcome | null;
  checklistItems?: ChecklistItem[];
}): Step {
  const s = new Step();
  s.id = overrides.id ?? `step-${overrides.position}`;
  s.position = overrides.position;
  s.name = overrides.name ?? `Step ${overrides.position}`;
  s.outcome = overrides.outcome ?? null;
  s.blocked = false;
  s.deadline = null;
  s.owner = null;
  s.createdAt = new Date('2026-07-01');
  s.updatedAt = new Date('2026-07-01');
  s.checklistItems = stubCollection(overrides.checklistItems ?? []);
  return s;
}

function buildWorkstream(overrides: {
  startedAt?: Date | null;
  completedAt?: Date | null;
  currentStep?: Step | null;
  steps: Step[];
  updatedAt?: Date;
}): Workstream {
  const ws = new Workstream();
  ws.id = 'ws-1';
  ws.name = 'Test';
  ws.icon = '🔧';
  ws.startedAt = overrides.startedAt ?? null;
  ws.completedAt = overrides.completedAt ?? null;
  ws.currentStep = overrides.currentStep ?? null;
  ws.updatedAt = overrides.updatedAt ?? new Date('2026-07-01');
  ws.createdAt = new Date('2026-07-01');
  ws.steps = stubCollection(overrides.steps);
  ws.owner = null;
  ws.group = null;
  return ws;
}

// --- Mock repositories ---

type ApplyCallback = (
  ws: Workstream,
) => LockedWorkstreamChanges | undefined | void;

function createService() {
  let lastChanges: LockedWorkstreamChanges | undefined | void;
  let testWorkstream: Workstream | null = null;

  const workstreamRepo = {
    updateLockedDetails: vi.fn(
      (_id: string, apply: ApplyCallback): Workstream => {
        lastChanges = apply(testWorkstream!);
        return testWorkstream!;
      },
    ),
    findDetails: vi.fn(() => testWorkstream!),
    countNotesByStep: vi.fn(() => new Map<string, number>()),
  };
  const userRepo = { findOneOrFail: vi.fn() };

  const service = new WorkstreamService(
    workstreamRepo as never,
    { findOneOrFail: vi.fn() } as never,
    { findOneInProject: vi.fn() } as never,
    userRepo as never,
  );

  return {
    service,
    userRepo,
    setWorkstream(ws: Workstream) {
      testWorkstream = ws;
    },
    getChanges() {
      return lastChanges;
    },
  };
}

// --- Tests ---

const T0 = new Date('2026-07-01');
const T0_ISO = T0.toISOString();

function pipelineDto(
  overrides: Partial<UpdatePipelineDto> = {},
): UpdatePipelineDto {
  return {
    expectedUpdatedAt: T0_ISO,
    steps: [],
    ...overrides,
  };
}

// New Step() entities created inside replacePipeline have real Collections
// that need an EntityManager. Patch the prototype so they work in unit tests.
beforeEach(() => {
  vi.spyOn(Collection.prototype, 'getItems').mockReturnValue([]);
  vi.spyOn(Collection.prototype, 'remove').mockImplementation(
    (() => 0) as never,
  );
  vi.spyOn(Collection.prototype, 'add').mockImplementation((() => 0) as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('workstreamService.updatePipeline — validation', () => {
  it('rejects a stale expectedUpdatedAt', async () => {
    const { service, setWorkstream } = createService();
    setWorkstream(buildWorkstream({ steps: [buildStep({ position: 1 })] }));

    await expect(
      service.updatePipeline(
        'ws-1',
        pipelineDto({ expectedUpdatedAt: '2020-01-01T00:00:00.000Z' }),
      ),
    ).rejects.toThrow('This pipeline changed after editing began');
  });

  it('rejects editing a complete workstream', async () => {
    const { service, setWorkstream } = createService();
    setWorkstream(
      buildWorkstream({
        startedAt: new Date(),
        completedAt: new Date(),
        steps: [],
      }),
    );

    await expect(service.updatePipeline('ws-1', pipelineDto())).rejects.toThrow(
      'Completed workstream pipelines cannot be edited',
    );
  });

  it('rejects duplicate submitted step IDs', async () => {
    const { service, setWorkstream } = createService();
    setWorkstream(
      buildWorkstream({ steps: [buildStep({ id: 's1', position: 1 })] }),
    );

    await expect(
      service.updatePipeline(
        'ws-1',
        pipelineDto({
          steps: [
            {
              id: 's1',
              name: 'A',
              deadline: null,
              ownerId: null,
              blocked: false,
              checklistItems: [],
            },
            {
              id: 's1',
              name: 'B',
              deadline: null,
              ownerId: null,
              blocked: false,
              checklistItems: [],
            },
          ],
        }),
      ),
    ).rejects.toThrow(
      'The submitted pipeline does not match the editable workstream tail',
    );
  });

  it('rejects submitting a past step ID', async () => {
    const { service, setWorkstream } = createService();
    const past = buildStep({
      id: 's-past',
      position: 1,
      outcome: StepOutcome.Done,
    });
    setWorkstream(
      buildWorkstream({
        steps: [past, buildStep({ id: 's-edit', position: 2 })],
      }),
    );

    await expect(
      service.updatePipeline(
        'ws-1',
        pipelineDto({
          steps: [
            {
              id: 's-past',
              name: 'Edited',
              deadline: null,
              ownerId: null,
              blocked: false,
              checklistItems: [],
            },
          ],
        }),
      ),
    ).rejects.toThrow('Past steps cannot be edited');
  });

  it('rejects an unknown step ID', async () => {
    const { service, setWorkstream } = createService();
    setWorkstream(
      buildWorkstream({ steps: [buildStep({ id: 's1', position: 1 })] }),
    );

    await expect(
      service.updatePipeline(
        'ws-1',
        pipelineDto({
          steps: [
            {
              id: 'unknown',
              name: 'Ghost',
              deadline: null,
              ownerId: null,
              blocked: false,
              checklistItems: [],
            },
          ],
        }),
      ),
    ).rejects.toThrow(
      'The submitted pipeline does not match the editable workstream tail',
    );
  });

  it('rejects removing the current step from an active workstream', async () => {
    const { service, setWorkstream } = createService();
    const current = buildStep({ id: 's-current', position: 1 });
    setWorkstream(
      buildWorkstream({
        startedAt: new Date(),
        currentStep: current,
        steps: [current, buildStep({ id: 's-future', position: 2 })],
      }),
    );

    await expect(
      service.updatePipeline(
        'ws-1',
        pipelineDto({
          steps: [
            {
              id: 's-future',
              name: 'Future',
              deadline: null,
              ownerId: null,
              blocked: false,
              checklistItems: [],
            },
          ],
        }),
      ),
    ).rejects.toThrow(
      'The current step must remain first in the editable pipeline',
    );
  });
});

describe('workstreamService.updatePipeline — mutations', () => {
  it('removes steps not in the submission', async () => {
    const { service, setWorkstream, getChanges } = createService();
    const s1 = buildStep({ id: 's1', position: 1 });
    const s2 = buildStep({ id: 's2', position: 2 });
    setWorkstream(buildWorkstream({ steps: [s1, s2] }));

    await service.updatePipeline(
      'ws-1',
      pipelineDto({
        steps: [
          {
            id: 's1',
            name: 'Keep',
            deadline: null,
            ownerId: null,
            blocked: false,
            checklistItems: [],
          },
        ],
      }),
    );

    expect(getChanges()?.removedSteps).toContain(s2);
  });

  it('adds new steps to the collection', async () => {
    const { service, setWorkstream } = createService();
    const s1 = buildStep({ id: 's1', position: 1 });
    const ws = buildWorkstream({ steps: [s1] });
    setWorkstream(ws);

    await service.updatePipeline(
      'ws-1',
      pipelineDto({
        steps: [
          {
            id: 's1',
            name: 'Existing',
            deadline: null,
            ownerId: null,
            blocked: false,
            checklistItems: [],
          },
          {
            name: 'New step',
            deadline: null,
            ownerId: null,
            blocked: false,
            checklistItems: [],
          },
        ],
      }),
    );

    const stepNames = ws.steps.getItems().map((s) => s.name);
    expect(stepNames).toContain('New step');
  });

  it('updates fields on existing steps', async () => {
    const { service, setWorkstream } = createService();
    const s1 = buildStep({ id: 's1', position: 1, name: 'Old name' });
    setWorkstream(buildWorkstream({ steps: [s1] }));

    await service.updatePipeline(
      'ws-1',
      pipelineDto({
        steps: [
          {
            id: 's1',
            name: 'New name',
            deadline: '2026-09-01',
            ownerId: null,
            blocked: true,
            checklistItems: [],
          },
        ],
      }),
    );

    expect(s1.name).toBe('New name');
    expect(s1.deadline).toBe('2026-09-01');
    expect(s1.blocked).toBe(true);
  });

  it('assigns positions after past steps', async () => {
    const { service, setWorkstream } = createService();
    const past = buildStep({
      id: 's-past',
      position: 1,
      outcome: StepOutcome.Done,
    });
    const current = buildStep({ id: 's-current', position: 2 });
    const ws = buildWorkstream({
      startedAt: new Date(),
      currentStep: current,
      steps: [past, current],
    });
    setWorkstream(ws);

    await service.updatePipeline(
      'ws-1',
      pipelineDto({
        steps: [
          {
            id: 's-current',
            name: 'Current',
            deadline: null,
            ownerId: null,
            blocked: false,
            checklistItems: [],
          },
          {
            name: 'New',
            deadline: null,
            ownerId: null,
            blocked: false,
            checklistItems: [],
          },
        ],
      }),
    );

    expect(current.position).toBe(2);
    const newStep = ws.steps.getItems().find((s) => s.name === 'New');
    expect(newStep?.position).toBe(3);
  });

  it('resolves step owners from the user repository', async () => {
    const { service, setWorkstream, userRepo } = createService();
    const user = buildUser('u1');
    userRepo.findOneOrFail.mockResolvedValue(user);
    const s1 = buildStep({ id: 's1', position: 1 });
    setWorkstream(buildWorkstream({ steps: [s1] }));

    await service.updatePipeline(
      'ws-1',
      pipelineDto({
        steps: [
          {
            id: 's1',
            name: 'Owned',
            deadline: null,
            ownerId: 'u1',
            blocked: false,
            checklistItems: [],
          },
        ],
      }),
    );

    expect(s1.owner).toBe(user);
  });

  it('removes checklist items not in the submission', async () => {
    const ci1 = buildChecklistItem('ci1', 'Keep');
    const ci2 = buildChecklistItem('ci2', 'Remove');
    const s1 = buildStep({
      id: 's1',
      position: 1,
      checklistItems: [ci1, ci2],
    });
    const { service, setWorkstream, getChanges } = createService();
    setWorkstream(buildWorkstream({ steps: [s1] }));

    await service.updatePipeline(
      'ws-1',
      pipelineDto({
        steps: [
          {
            id: 's1',
            name: 'Step',
            deadline: null,
            ownerId: null,
            blocked: false,
            checklistItems: [{ id: 'ci1', name: 'Keep', done: false }],
          },
        ],
      }),
    );

    expect(getChanges()?.removedChecklistItems).toContain(ci2);
  });

  it('adds new checklist items when no id is provided', async () => {
    const s1 = buildStep({ id: 's1', position: 1, checklistItems: [] });
    const { service, setWorkstream } = createService();
    setWorkstream(buildWorkstream({ steps: [s1] }));

    await service.updatePipeline(
      'ws-1',
      pipelineDto({
        steps: [
          {
            id: 's1',
            name: 'Step',
            deadline: null,
            ownerId: null,
            blocked: false,
            checklistItems: [{ name: 'New item', done: true }],
          },
        ],
      }),
    );

    const items = s1.checklistItems.getItems();
    expect(items).toHaveLength(1);
    expect(items[0]!.name).toBe('New item');
    expect(items[0]!.done).toBe(true);
  });

  it('bumps updatedAt to at least now', async () => {
    const { service, setWorkstream } = createService();
    const ws = buildWorkstream({
      steps: [buildStep({ id: 's1', position: 1 })],
    });
    setWorkstream(ws);
    const before = Date.now();

    await service.updatePipeline(
      'ws-1',
      pipelineDto({
        steps: [
          {
            id: 's1',
            name: 'Step',
            deadline: null,
            ownerId: null,
            blocked: false,
            checklistItems: [],
          },
        ],
      }),
    );

    expect(ws.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
  });
});
