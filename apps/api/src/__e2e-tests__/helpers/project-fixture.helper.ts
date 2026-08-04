import { randomUUID } from 'node:crypto';

import { Project } from '@/database/entities/project.entity';
import { User } from '@/database/entities/user.entity';

import type { SqlEntityManager } from '@mikro-orm/postgresql';

/**
 * Every project needs an owner. Specs that only exercise content routes don't
 * care who it is, so each fixture gets its own throwaway owner.
 */
export function createProjectFixture(
  em: SqlEntityManager,
  data: { name?: string; eventDate?: string } = {},
): Project {
  const owner = em.create(User, {
    email: `project-owner-${randomUUID()}@example.com`,
    name: 'Project Owner',
    avatarUrl: null,
  });

  return em.create(Project, {
    name: data.name ?? 'Wedding Prep',
    eventDate: data.eventDate ?? null,
    owner,
  });
}
