import { randomUUID } from 'node:crypto';

import { ProjectMember } from '@/database/entities/project-member.entity';
import { Project } from '@/database/entities/project.entity';
import { User } from '@/database/entities/user.entity';

import type { SqlEntityManager } from '@mikro-orm/postgresql';

/** The email `MockTokenFactory.validToken()` mints, i.e. the default actor. */
export const DEFAULT_ACTOR_EMAIL = 'e2e@example.com';

/** Joins `user` to the project — owner assignment 422s for non-members. */
export function addJoinedMember(
  em: SqlEntityManager,
  projectId: string,
  user: User,
): void {
  em.create(ProjectMember, {
    project: em.getReference(Project, projectId),
    email: user.email,
    user,
  });
}

/**
 * Every project needs an owner. Specs that only exercise content routes don't
 * care who it is, so each fixture gets its own throwaway owner.
 *
 * Content routes are membership-scoped, so the fixture also writes a member
 * row for each `memberEmails` entry (default: the default actor). A row is
 * linked to its user when that user already exists; otherwise it is left
 * pending and attach-on-login claims it at the next `signIn` for that email.
 */
export async function createProjectFixture(
  em: SqlEntityManager,
  data: {
    name?: string;
    eventDate?: string;
    memberEmails?: readonly string[];
  } = {},
): Promise<Project> {
  const owner = em.create(User, {
    email: `project-owner-${randomUUID()}@example.com`,
    name: 'Project Owner',
    avatarUrl: null,
  });

  const project = em.create(Project, {
    name: data.name ?? 'Wedding Prep',
    eventDate: data.eventDate ?? null,
    owner,
  });

  const memberEmails = data.memberEmails ?? [DEFAULT_ACTOR_EMAIL];
  for (const email of memberEmails) {
    em.create(ProjectMember, {
      project,
      email,
      user: await em.findOne(User, { email }),
    });
  }

  return project;
}
