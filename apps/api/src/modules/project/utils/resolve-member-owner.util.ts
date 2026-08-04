import { unprocessable } from '@/modules/project/utils/unprocessable.util';

import type { User } from '@/database/entities/user.entity';
import type { ProjectRepository } from '@/modules/project/repositories/project.repository';

/** Owner assignment guard (ADR 0006): unknown ids and non-members 422 alike. */
export async function resolveMemberOwner(
  projectRepository: ProjectRepository,
  ownerId: string,
  projectId: string,
): Promise<User> {
  const owner = await projectRepository.findJoinedMember(projectId, ownerId);

  if (!owner) {
    unprocessable(
      'owner-not-member',
      'The owner must be a member of this project',
    );
  }

  return owner;
}
