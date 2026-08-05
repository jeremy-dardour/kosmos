import { HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { User } from '@/database/entities/user.entity';
import { ProjectService } from '@/modules/project/project.service';
import { ProblemDetailsException } from '@/shared/exceptions/problem-details.exception';

import type { Project } from '@/database/entities/project.entity';
import type {
  RestoreContext,
  TransferOwnershipContext,
} from '@/modules/project/repositories/project.repository';

function buildCurrentUser(): User {
  const currentUser = new User();
  currentUser.id = 'user-1';
  currentUser.email = 'someone@example.com';
  currentUser.name = 'Someone';

  return currentUser;
}

function createService(ownedCount: number) {
  const projectRepository = {
    createOwned: vi.fn((_owner: User, build: (count: number) => Project) =>
      Promise.resolve(build(ownedCount)),
    ),
  };

  const configService = { get: vi.fn(() => 20) };

  return {
    service: new ProjectService(
      projectRepository as never,
      configService as never,
    ),
    projectRepository,
  };
}

describe('projectService.create', () => {
  it('makes the currentUser the owner of the new project', async () => {
    const currentUser = buildCurrentUser();
    const { service, projectRepository } = createService(19);

    const project = await service.create(
      { name: 'Wedding Prep', eventDate: '2027-06-12' },
      currentUser,
    );

    expect(project).toMatchObject({
      name: 'Wedding Prep',
      eventDate: '2027-06-12',
      owner: currentUser,
    });
    expect(projectRepository.createOwned).toHaveBeenCalledWith(
      currentUser,
      expect.any(Function),
    );
  });

  it('refuses to exceed the owned-project cap', async () => {
    const { service } = createService(20);

    const create = service.create({ name: 'One Too Many' }, buildCurrentUser());

    await expect(create).rejects.toThrow(ProblemDetailsException);
    await expect(create).rejects.toMatchObject({
      typeSlug: 'project-limit-reached',
      status: HttpStatus.CONFLICT,
    });
  });
});

function buildMember(userId: string | null) {
  const user = userId ? new User() : null;
  if (user && userId) user.id = userId;

  return { id: 'row-1', user } as never;
}

function createGovernanceService(
  transferContext: Partial<TransferOwnershipContext>,
  restoreContext: Partial<RestoreContext> = {},
) {
  const projectRepository = {
    transferOwnership: vi.fn(
      (
        _id: string,
        _currentUserId: string,
        _memberId: string,
        decide: (context: TransferOwnershipContext) => User,
      ) => {
        const owner = decide({
          ownerId: 'owner-1',
          targetMember: null,
          ...transferContext,
        });

        return Promise.resolve({ owner } as never);
      },
    ),
    softDelete: vi.fn(
      (
        _id: string,
        _currentUserId: string,
        decide: (context: { ownerId: string }) => void,
      ) => {
        decide({ ownerId: 'owner-1' });

        return Promise.resolve();
      },
    ),
    restoreOwned: vi.fn(
      (
        _id: string,
        _currentUserId: string,
        decide: (context: RestoreContext) => void,
      ) => {
        decide({
          ownerId: 'owner-1',
          isDeleted: true,
          liveOwnedCount: 0,
          ...restoreContext,
        });

        return Promise.resolve({} as never);
      },
    ),
  };

  const configService = { get: vi.fn(() => 20) };

  return new ProjectService(projectRepository as never, configService as never);
}

function buildOwner(): User {
  const owner = buildCurrentUser();
  owner.id = 'owner-1';

  return owner;
}

describe('projectService.transferOwnership', () => {
  it('rejects a non-owner with 403 not-project-owner', async () => {
    const service = createGovernanceService({
      targetMember: buildMember('user-9'),
    });

    await expect(
      service.transferOwnership(
        'p1',
        { memberId: 'row-1' },
        buildCurrentUser(),
      ),
    ).rejects.toMatchObject({
      typeSlug: 'not-project-owner',
      status: HttpStatus.FORBIDDEN,
    });
  });

  it.each([
    ['a pending member row', buildMember(null)],
    ['a foreign or unknown member id', null],
  ])('rejects %s with 409 transfer-target-not-member', async (_name, row) => {
    const service = createGovernanceService({ targetMember: row });

    await expect(
      service.transferOwnership('p1', { memberId: 'row-1' }, buildOwner()),
    ).rejects.toMatchObject({
      typeSlug: 'transfer-target-not-member',
      status: HttpStatus.CONFLICT,
    });
  });

  it("returns the target member's user as the new owner", async () => {
    const service = createGovernanceService({
      targetMember: buildMember('user-9'),
    });

    const project = await service.transferOwnership(
      'p1',
      { memberId: 'row-1' },
      buildOwner(),
    );

    expect(project.owner.id).toBe('user-9');
  });
});

describe('projectService.softDelete', () => {
  it('rejects a non-owner with 403 not-project-owner', async () => {
    const service = createGovernanceService({});

    await expect(
      service.softDelete('p1', buildCurrentUser()),
    ).rejects.toMatchObject({
      typeSlug: 'not-project-owner',
      status: HttpStatus.FORBIDDEN,
    });
  });
});

describe('projectService.restore', () => {
  it('rejects a non-owner with 403 before any state check', async () => {
    const service = createGovernanceService({}, { isDeleted: false });

    await expect(
      service.restore('p1', buildCurrentUser()),
    ).rejects.toMatchObject({
      typeSlug: 'not-project-owner',
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('rejects a live project with 409 project-not-deleted before the cap check', async () => {
    const service = createGovernanceService(
      {},
      { isDeleted: false, liveOwnedCount: 20 },
    );

    await expect(service.restore('p1', buildOwner())).rejects.toMatchObject({
      typeSlug: 'project-not-deleted',
      status: HttpStatus.CONFLICT,
    });
  });

  it('rejects restoring past the owned-project cap', async () => {
    const service = createGovernanceService({}, { liveOwnedCount: 20 });

    await expect(service.restore('p1', buildOwner())).rejects.toMatchObject({
      typeSlug: 'project-limit-reached',
      status: HttpStatus.CONFLICT,
    });
  });

  it('restores below the cap', async () => {
    const service = createGovernanceService({}, { liveOwnedCount: 19 });

    await expect(service.restore('p1', buildOwner())).resolves.toBeDefined();
  });
});
