import { HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { User } from '@/database/entities/user.entity';
import { ProjectService } from '@/modules/project/project.service';
import { ProblemDetailsException } from '@/shared/exceptions/problem-details.exception';

import type { Project } from '@/database/entities/project.entity';

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
