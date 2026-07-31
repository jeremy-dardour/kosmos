import { describe, expect, it, vi } from 'vitest';

import { Group } from '@/database/entities/group.entity';
import { Project } from '@/database/entities/project.entity';
import { Workstream } from '@/database/entities/workstream.entity';
import { WorkstreamService } from '@/modules/project/workstream.service';

import type { Collection } from '@mikro-orm/core';

const T0 = new Date('2026-07-01');

function buildGroup(id: string): Group {
  const group = new Group();
  group.id = id;
  group.name = `Group ${id}`;
  group.color = '#5a9e6f';
  group.position = 0;

  return group;
}

function buildWorkstream(group: Group | null): Workstream {
  const project = new Project();
  project.id = 'project-1';
  project.name = 'Wedding Prep';

  const workstream = new Workstream();
  workstream.id = 'ws-1';
  workstream.name = 'Catering';
  workstream.icon = '🍽️';
  workstream.position = 2;
  workstream.project = project;
  workstream.group = group;
  workstream.owner = null;
  workstream.startedAt = null;
  workstream.completedAt = null;
  workstream.currentStep = null;
  workstream.createdAt = T0;
  workstream.updatedAt = T0;
  workstream.steps = { getItems: () => [] } as unknown as Collection<never>;

  return workstream;
}

function createService(workstream: Workstream, targetGroup?: Group) {
  const workstreamRepo = {
    findOneOrFail: vi.fn(() => workstream),
    findDetails: vi.fn(() => workstream),
    countNotesByStep: vi.fn(() => new Map<string, number>()),
    save: vi.fn(),
    saveMovedToGroup: vi.fn(),
  };
  const groupRepo = {
    findOneInProject: vi.fn(() => targetGroup ?? null),
  };

  const service = new WorkstreamService(
    workstreamRepo as never,
    { findOneOrFail: vi.fn() } as never,
    groupRepo as never,
    { findOneOrFail: vi.fn() } as never,
  );

  return { service, workstreamRepo };
}

describe('workstreamService.update — group scope', () => {
  it('renumbers both scopes when the group changes', async () => {
    const target = buildGroup('group-2');
    const workstream = buildWorkstream(buildGroup('group-1'));
    const { service, workstreamRepo } = createService(workstream, target);

    await service.update('ws-1', { groupId: 'group-2' });

    expect(workstreamRepo.saveMovedToGroup).toHaveBeenCalledWith(
      workstream,
      target,
    );
    expect(workstreamRepo.save).not.toHaveBeenCalled();
  });

  it('renumbers both scopes when a workstream is ungrouped', async () => {
    const workstream = buildWorkstream(buildGroup('group-1'));
    const { service, workstreamRepo } = createService(workstream);

    await service.update('ws-1', { groupId: null });

    expect(workstreamRepo.saveMovedToGroup).toHaveBeenCalledWith(
      workstream,
      null,
    );
  });

  it('keeps the position when the submitted group is the current one', async () => {
    const group = buildGroup('group-1');
    const workstream = buildWorkstream(group);
    const { service, workstreamRepo } = createService(workstream, group);

    await service.update('ws-1', {
      name: 'Catering & Bar',
      groupId: 'group-1',
    });

    expect(workstreamRepo.save).toHaveBeenCalledWith(workstream);
    expect(workstreamRepo.saveMovedToGroup).not.toHaveBeenCalled();
  });

  it('keeps the position when no group is submitted', async () => {
    const workstream = buildWorkstream(buildGroup('group-1'));
    const { service, workstreamRepo } = createService(workstream);

    await service.update('ws-1', { name: 'Catering & Bar' });

    expect(workstreamRepo.save).toHaveBeenCalledWith(workstream);
    expect(workstreamRepo.saveMovedToGroup).not.toHaveBeenCalled();
  });
});
