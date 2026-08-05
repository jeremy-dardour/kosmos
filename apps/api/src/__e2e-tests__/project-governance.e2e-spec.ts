import request from 'supertest';

import { createTestApp } from '@/__e2e-tests__/helpers/create-app.helper';
import { MockTokenFactory } from '@/__e2e-tests__/helpers/mock-token.factory';
import {
  resetDatabase,
  testEntityManager,
} from '@/__e2e-tests__/helpers/reset-database.helper';
import { signIn } from '@/__e2e-tests__/helpers/sign-in.helper';
import { MockOidcService } from '@/__e2e-tests__/mocks/mock-oidc.service';
import { ProjectMember } from '@/database/entities/project-member.entity';
import { Project } from '@/database/entities/project.entity';
import { User } from '@/database/entities/user.entity';

import type { MemberDto } from '@/modules/project/dtos/output/member.dto';
import type { ProjectDto } from '@/modules/project/dtos/output/project.dto';
import type { SqlEntityManager } from '@mikro-orm/postgresql';
import type { INestApplication } from '@nestjs/common';
import type { Test as SuperTestType } from 'supertest';
import type TestAgent from 'supertest/lib/agent';

function createRequest(app: INestApplication): TestAgent<SuperTestType> {
  return request(app.getHttpServer() as never);
}

function expectSlug(body: unknown, slug: string): void {
  expect((body as { type: string }).type).toMatch(
    new RegExp(`/errors/${slug}$`),
  );
}

// Both in `.env.e2e`'s AUTH_ALLOWED_EMAILS.
const OWNER_EMAIL = 'tenant-a@example.com';
const MEMBER_EMAIL = 'tenant-b@example.com';
const INVITED_EMAIL = 'tenant-pending@example.com';

describe('Project Governance E2E Tests', () => {
  const mockOidc = new MockOidcService();
  let tokenFactory: MockTokenFactory;
  let app: INestApplication;
  let em: SqlEntityManager;
  let authOwner: string;
  let authMember: string;
  let ownerId: string;
  let memberUserId: string;
  let projectId: string;
  let memberRowId: string;

  beforeAll(async () => {
    await mockOidc.setup();
    tokenFactory = new MockTokenFactory(mockOidc, process.env.AUTH_CLIENT_ID!);
  });

  beforeEach(async () => {
    app = await createTestApp({ oidcOverride: mockOidc });
    em = testEntityManager(app);
    await resetDatabase(em);

    authOwner = `Bearer ${await tokenFactory.createToken({ email: OWNER_EMAIL })}`;
    authMember = `Bearer ${await tokenFactory.createToken({ email: MEMBER_EMAIL })}`;
    const ownerUser = await signIn(app, authOwner);
    const memberUser = await signIn(app, authMember);
    ownerId = ownerUser.id;
    memberUserId = memberUser.id;

    const created = await createRequest(app)
      .post('/projects')
      .set('Authorization', authOwner)
      .send({ name: 'Launch' })
      .expect(201);
    projectId = (created.body as ProjectDto).id;

    const added = await createRequest(app)
      .post(`/projects/${projectId}/members`)
      .set('Authorization', authOwner)
      .send({ email: MEMBER_EMAIL })
      .expect(201);
    memberRowId = (added.body as MemberDto).id;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('transfer ownership', () => {
    it('moves ownerId to the joined member and keeps both member rows', async () => {
      const response = await createRequest(app)
        .post(`/projects/${projectId}/transfer-ownership`)
        .set('Authorization', authOwner)
        .send({ memberId: memberRowId })
        .expect(200);

      expect((response.body as ProjectDto).ownerId).toBe(memberUserId);

      const members = await createRequest(app)
        .get(`/projects/${projectId}/members`)
        .set('Authorization', authMember)
        .expect(200);
      const rows = members.body as MemberDto[];
      expect(rows).toHaveLength(2);
      expect(rows.find((m) => m.userId === memberUserId)?.isOwner).toBe(true);
      expect(rows.find((m) => m.userId === ownerId)?.isOwner).toBe(false);

      // The previous owner is a plain member now: governance re-gates.
      const back = await createRequest(app)
        .post(`/projects/${projectId}/transfer-ownership`)
        .set('Authorization', authOwner)
        .send({ memberId: memberRowId })
        .expect(403);
      expectSlug(back.body, 'not-project-owner');
    });

    it('rejects a pending row and a foreign member row with 409 transfer-target-not-member', async () => {
      const pending = await createRequest(app)
        .post(`/projects/${projectId}/members`)
        .set('Authorization', authOwner)
        .send({ email: INVITED_EMAIL })
        .expect(201);

      const pendingTarget = await createRequest(app)
        .post(`/projects/${projectId}/transfer-ownership`)
        .set('Authorization', authOwner)
        .send({ memberId: (pending.body as MemberDto).id })
        .expect(409);
      expectSlug(pendingTarget.body, 'transfer-target-not-member');

      const otherProject = await createRequest(app)
        .post('/projects')
        .set('Authorization', authOwner)
        .send({ name: 'Other' })
        .expect(201);
      const otherMembers = await createRequest(app)
        .get(`/projects/${(otherProject.body as ProjectDto).id}/members`)
        .set('Authorization', authOwner)
        .expect(200);

      const foreignTarget = await createRequest(app)
        .post(`/projects/${projectId}/transfer-ownership`)
        .set('Authorization', authOwner)
        .send({ memberId: (otherMembers.body as MemberDto[])[0]!.id })
        .expect(409);
      expectSlug(foreignTarget.body, 'transfer-target-not-member');
    });
  });

  describe('soft delete and restore', () => {
    it('hides the project from members everywhere while the owner keeps a flagged list entry', async () => {
      await createRequest(app)
        .delete(`/projects/${projectId}`)
        .set('Authorization', authOwner)
        .expect(204);

      // Members: gone from list and deep links.
      const memberList = await createRequest(app)
        .get('/projects')
        .set('Authorization', authMember)
        .expect(200);
      expect((memberList.body as ProjectDto[]).map((p) => p.id)).not.toContain(
        projectId,
      );
      await createRequest(app)
        .get(`/projects/${projectId}`)
        .set('Authorization', authMember)
        .expect(404);

      // Owner: flagged in the list, but not openable.
      const ownerList = await createRequest(app)
        .get('/projects')
        .set('Authorization', authOwner)
        .expect(200);
      const flagged = (ownerList.body as ProjectDto[]).find(
        (p) => p.id === projectId,
      );
      expect(flagged?.deletedAt).not.toBeNull();
      await createRequest(app)
        .get(`/projects/${projectId}`)
        .set('Authorization', authOwner)
        .expect(404);
    });

    it('restore reverses the deletion for everyone', async () => {
      await createRequest(app)
        .delete(`/projects/${projectId}`)
        .set('Authorization', authOwner)
        .expect(204);

      const restored = await createRequest(app)
        .post(`/projects/${projectId}/restore`)
        .set('Authorization', authOwner)
        .expect(200);
      expect((restored.body as ProjectDto).deletedAt).toBeNull();

      await createRequest(app)
        .get(`/projects/${projectId}`)
        .set('Authorization', authMember)
        .expect(200);
    });

    it('rejects restoring a live project with 409 project-not-deleted', async () => {
      const response = await createRequest(app)
        .post(`/projects/${projectId}/restore`)
        .set('Authorization', authOwner)
        .expect(409);

      expectSlug(response.body, 'project-not-deleted');
    });

    it('excludes deleted projects from the create cap', async () => {
      await seedOwnedProjects(19);

      // 20 live (19 seeded + the fixture project): at the cap.
      const atCap = await createRequest(app)
        .post('/projects')
        .set('Authorization', authOwner)
        .send({ name: 'One too many' })
        .expect(409);
      expectSlug(atCap.body, 'project-limit-reached');

      await createRequest(app)
        .delete(`/projects/${projectId}`)
        .set('Authorization', authOwner)
        .expect(204);

      await createRequest(app)
        .post('/projects')
        .set('Authorization', authOwner)
        .send({ name: 'Fits again' })
        .expect(201);
    });

    it('rejects restore at the owned-project cap with 409 project-limit-reached', async () => {
      await createRequest(app)
        .delete(`/projects/${projectId}`)
        .set('Authorization', authOwner)
        .expect(204);
      await seedOwnedProjects(20);

      const response = await createRequest(app)
        .post(`/projects/${projectId}/restore`)
        .set('Authorization', authOwner)
        .expect(409);
      expectSlug(response.body, 'project-limit-reached');
    });
  });

  async function seedOwnedProjects(count: number): Promise<void> {
    const owner = await em.findOneOrFail(User, { id: ownerId });
    for (let i = 0; i < count; i += 1) {
      const project = em.create(Project, { name: `Owned ${i}`, owner });
      em.create(ProjectMember, { project, email: owner.email, user: owner });
    }
    await em.flush();
  }
});
