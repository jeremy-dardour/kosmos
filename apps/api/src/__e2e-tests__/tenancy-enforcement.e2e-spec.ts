import request from 'supertest';

import { createTestApp } from '@/__e2e-tests__/helpers/create-app.helper';
import { MockTokenFactory } from '@/__e2e-tests__/helpers/mock-token.factory';
import {
  resetDatabase,
  testEntityManager,
} from '@/__e2e-tests__/helpers/reset-database.helper';
import { signIn } from '@/__e2e-tests__/helpers/sign-in.helper';
import { MockOidcService } from '@/__e2e-tests__/mocks/mock-oidc.service';
import { ChecklistItem } from '@/database/entities/checklist-item.entity';
import { Group } from '@/database/entities/group.entity';
import { Note } from '@/database/entities/note.entity';
import { ProjectMember } from '@/database/entities/project-member.entity';
import { Project } from '@/database/entities/project.entity';
import { Step, StepOutcome } from '@/database/entities/step.entity';
import { User } from '@/database/entities/user.entity';
import { Workstream } from '@/database/entities/workstream.entity';

import type { ProjectDto } from '@/modules/project/dtos/output/project.dto';
import type { SqlEntityManager } from '@mikro-orm/postgresql';
import type { INestApplication } from '@nestjs/common';
import type { Test as SuperTestType } from 'supertest';
import type TestAgent from 'supertest/lib/agent';

/**
 * The T-2 tenancy sweep (#54): two users, two projects, and every content
 * route asserted route-by-route — the member gets its normal success, the
 * non-member gets a 404 indistinguishable from a nonexistent id, and a
 * soft-deleted project 404s even for its owner.
 *
 * Pattern for later tickets: each route is one entry in `ROUTES`, described
 * by how to issue it against the shared fixture and the member's expected
 * status. Both the non-member matrix and the soft-deleted matrix iterate the
 * same table, so a new route added there is automatically swept by both.
 * Feature specs stay the proof of member-path behavior; this spec only proves
 * the authorization boundary.
 * T-4 will need per-axis expectations for restore and owner-only routes.
 */

const TENANT_A_EMAIL = 'tenant-a@example.com';
const TENANT_B_EMAIL = 'tenant-b@example.com';
const PENDING_EMAIL = 'tenant-pending@example.com';

interface Fixture {
  projectId: string;
  groupId: string;
  activeWorkstreamId: string;
  freshWorkstreamId: string;
  currentStepId: string;
  futureStepIds: [string, string];
  checklistItemId: string;
  noteId: string;
  actorAUserId: string;
  actorBUserId: string;
}

interface RouteCase {
  name: string;
  issue: (agent: TestAgent<SuperTestType>, fixture: Fixture) => SuperTestType;
  memberStatus: number;
}

const ROUTES: readonly RouteCase[] = [
  {
    name: 'GET /projects/:id',
    issue: (agent, f) => agent.get(`/projects/${f.projectId}`),
    memberStatus: 200,
  },
  {
    name: 'PATCH /projects/:id',
    issue: (agent, f) =>
      agent.patch(`/projects/${f.projectId}`).send({ name: 'Renamed' }),
    memberStatus: 200,
  },
  {
    name: 'GET /projects/:projectId/overview',
    issue: (agent, f) => agent.get(`/projects/${f.projectId}/overview`),
    memberStatus: 200,
  },
  {
    name: 'GET /projects/:projectId/groups',
    issue: (agent, f) => agent.get(`/projects/${f.projectId}/groups`),
    memberStatus: 200,
  },
  {
    name: 'POST /projects/:projectId/groups',
    issue: (agent, f) =>
      agent
        .post(`/projects/${f.projectId}/groups`)
        .send({ name: 'New group', color: '#5a9e6f' }),
    memberStatus: 201,
  },
  {
    name: 'PUT /projects/:projectId/group-order',
    issue: (agent, f) =>
      agent
        .put(`/projects/${f.projectId}/group-order`)
        .send({ ids: [f.groupId] }),
    memberStatus: 200,
  },
  {
    name: 'PATCH /groups/:id',
    issue: (agent, f) =>
      agent.patch(`/groups/${f.groupId}`).send({ name: 'Renamed' }),
    memberStatus: 200,
  },
  {
    name: 'DELETE /groups/:id',
    issue: (agent, f) => agent.delete(`/groups/${f.groupId}`),
    memberStatus: 204,
  },
  {
    name: 'POST /projects/:projectId/workstreams',
    issue: (agent, f) =>
      agent
        .post(`/projects/${f.projectId}/workstreams`)
        .send({ name: 'Flowers', icon: '💐' }),
    memberStatus: 201,
  },
  {
    name: 'PUT /projects/:projectId/workstream-order',
    issue: (agent, f) =>
      agent.put(`/projects/${f.projectId}/workstream-order`).send({
        groupId: null,
        ids: [f.freshWorkstreamId, f.activeWorkstreamId],
      }),
    memberStatus: 200,
  },
  {
    name: 'PATCH /workstreams/:id',
    issue: (agent, f) =>
      agent
        .patch(`/workstreams/${f.activeWorkstreamId}`)
        .send({ name: 'Renamed' }),
    memberStatus: 200,
  },
  {
    name: 'POST /workstreams/:id/advance',
    issue: (agent, f) =>
      agent.post(`/workstreams/${f.activeWorkstreamId}/advance`).send({}),
    memberStatus: 200,
  },
  {
    name: 'POST /workstreams/:id/steps',
    issue: (agent, f) =>
      agent
        .post(`/workstreams/${f.activeWorkstreamId}/steps`)
        .send({ name: 'Appended', position: 5 }),
    memberStatus: 201,
  },
  {
    name: 'PUT /workstreams/:id/step-order',
    issue: (agent, f) =>
      agent.put(`/workstreams/${f.activeWorkstreamId}/step-order`).send({
        ids: [f.futureStepIds[1], f.futureStepIds[0]],
      }),
    memberStatus: 200,
  },
  {
    name: 'DELETE /workstreams/:id',
    issue: (agent, f) => agent.delete(`/workstreams/${f.freshWorkstreamId}`),
    memberStatus: 204,
  },
  {
    name: 'GET /workstreams/:id/notes',
    issue: (agent, f) =>
      agent.get(`/workstreams/${f.activeWorkstreamId}/notes`),
    memberStatus: 200,
  },
  {
    name: 'PATCH /steps/:id',
    issue: (agent, f) =>
      agent.patch(`/steps/${f.futureStepIds[0]}`).send({ name: 'Renamed' }),
    memberStatus: 200,
  },
  {
    name: 'DELETE /steps/:id',
    issue: (agent, f) => agent.delete(`/steps/${f.futureStepIds[0]}`),
    memberStatus: 200,
  },
  {
    name: 'POST /steps/:stepId/checklist-items',
    issue: (agent, f) =>
      agent
        .post(`/steps/${f.currentStepId}/checklist-items`)
        .send({ name: 'Sub-task' }),
    memberStatus: 201,
  },
  {
    name: 'PATCH /checklist-items/:id',
    issue: (agent, f) =>
      agent
        .patch(`/checklist-items/${f.checklistItemId}`)
        .send({ name: 'Renamed' }),
    memberStatus: 200,
  },
  {
    name: 'DELETE /checklist-items/:id',
    issue: (agent, f) => agent.delete(`/checklist-items/${f.checklistItemId}`),
    memberStatus: 204,
  },
  {
    name: 'POST /steps/:stepId/notes',
    issue: (agent, f) =>
      agent.post(`/steps/${f.currentStepId}/notes`).send({ content: 'Hello' }),
    memberStatus: 201,
  },
  {
    name: 'PATCH /notes/:id',
    issue: (agent, f) =>
      agent.patch(`/notes/${f.noteId}`).send({ content: 'Edited' }),
    memberStatus: 200,
  },
  {
    name: 'DELETE /notes/:id',
    issue: (agent, f) => agent.delete(`/notes/${f.noteId}`),
    memberStatus: 204,
  },
];

describe('Tenancy Enforcement E2E Tests', () => {
  const mockOidc = new MockOidcService();
  let tokenFactory: MockTokenFactory;
  let app: INestApplication;
  let em: SqlEntityManager;
  let authA: string;
  let authB: string;
  let fixture: Fixture;

  beforeAll(async () => {
    await mockOidc.setup();
    tokenFactory = new MockTokenFactory(mockOidc, process.env.AUTH_CLIENT_ID!);
  });

  beforeEach(async () => {
    app = await createTestApp({ oidcOverride: mockOidc });
    em = testEntityManager(app);
    await resetDatabase(em);

    authA = `Bearer ${await tokenFactory.createToken({ email: TENANT_A_EMAIL })}`;
    authB = `Bearer ${await tokenFactory.createToken({ email: TENANT_B_EMAIL })}`;
    const userA = await signIn(app, authA);
    const userB = await signIn(app, authB);

    fixture = await buildFixture(userA.id, userB.id);
  });

  afterEach(async () => {
    await app.close();
  });

  function createRequest(): TestAgent<SuperTestType> {
    return request(app.getHttpServer() as never);
  }

  async function createProjectAs(auth: string, name: string): Promise<string> {
    const response = await createRequest()
      .post('/projects')
      .set('Authorization', auth)
      .send({ name })
      .expect(201);

    return (response.body as ProjectDto).id;
  }

  /**
   * Project A (owner: user A) with a group, a started workstream carrying
   * past/current/future steps, a checklist item, a note by A and a pending
   * invite; plus B's own project so the non-member is a fully valid actor.
   */
  async function buildFixture(
    actorAUserId: string,
    actorBUserId: string,
  ): Promise<Fixture> {
    const projectId = await createProjectAs(authA, 'Tenant A Wedding');
    await createProjectAs(authB, 'Tenant B Wedding');

    const project = await em.findOneOrFail(Project, { id: projectId });
    const actorA = await em.findOneOrFail(User, { id: actorAUserId });

    em.create(ProjectMember, { project, email: PENDING_EMAIL, user: null });

    const group = em.create(Group, {
      project,
      position: 0,
      name: 'Vendors',
      color: '#5a9e6f',
    });

    const active = em.create(Workstream, {
      project,
      position: 0,
      name: 'Catering',
      icon: '🍽️',
      startedAt: new Date('2026-07-01T00:00:00.000Z'),
    });
    em.create(Step, {
      workstream: active,
      position: 1,
      name: 'Research',
      outcome: StepOutcome.Done,
      outcomeAt: new Date('2026-07-02T00:00:00.000Z'),
    });
    const current = em.create(Step, {
      workstream: active,
      position: 2,
      name: 'Shortlist',
    });
    const future1 = em.create(Step, {
      workstream: active,
      position: 3,
      name: 'Taste',
    });
    const future2 = em.create(Step, {
      workstream: active,
      position: 4,
      name: 'Book',
    });
    const checklistItem = em.create(ChecklistItem, {
      step: current,
      position: 1,
      name: 'Call venues',
      done: false,
    });

    const fresh = em.create(Workstream, {
      project,
      position: 1,
      name: 'Stationery',
      icon: '💌',
    });

    const note = em.create(Note, {
      step: current,
      author: actorA,
      content: 'Caterer shortlist started',
    });

    await em.flush();
    active.currentStep = current;
    await em.flush();

    return {
      projectId,
      groupId: group.id,
      activeWorkstreamId: active.id,
      freshWorkstreamId: fresh.id,
      currentStepId: current.id,
      futureStepIds: [future1.id, future2.id],
      checklistItemId: checklistItem.id,
      noteId: note.id,
      actorAUserId,
      actorBUserId,
    };
  }

  describe('non-member gets 404 on every route', () => {
    it.each(ROUTES.map((route) => [route.name, route] as const))(
      '%s',
      async (_name, route) => {
        await route
          .issue(createRequest(), fixture)
          .set('Authorization', authB)
          .expect(404);

        await route
          .issue(createRequest(), fixture)
          .set('Authorization', authA)
          .expect(route.memberStatus);
      },
    );

    it('does not reveal that a submitted group belongs to the project', async () => {
      const response = await createRequest()
        .put(`/projects/${fixture.projectId}/workstream-order`)
        .set('Authorization', authB)
        .send({ groupId: fixture.groupId, ids: [] })
        .expect(404);

      expect((response.body as { detail: string }).detail).not.toContain(
        'Group',
      );
    });
  });

  describe('soft-deleted project is invisible even to its owner', () => {
    it.each(ROUTES.map((route) => [route.name, route] as const))(
      '%s',
      async (_name, route) => {
        await em.nativeUpdate(
          Project,
          { id: fixture.projectId },
          { deletedAt: new Date() },
        );

        await route
          .issue(createRequest(), fixture)
          .set('Authorization', authA)
          .expect(404);
      },
    );
  });

  describe('users directory and owner assignment', () => {
    it('lists only joined members in the overview users directory', async () => {
      const response = await createRequest()
        .get(`/projects/${fixture.projectId}/overview`)
        .set('Authorization', authA)
        .expect(200);

      const users = (response.body as { users: { id: string }[] }).users;
      expect(users.map((user) => user.id)).toEqual([fixture.actorAUserId]);
    });

    it('accepts a joined member as workstream owner', async () => {
      await createRequest()
        .post(`/projects/${fixture.projectId}/workstreams`)
        .set('Authorization', authA)
        .send({ name: 'Music', icon: '🎶', ownerId: fixture.actorAUserId })
        .expect(201);
    });

    it.each([
      ['a non-member user', () => fixture.actorBUserId],
      ['an unknown id', () => '11111111-1111-4111-8111-111111111111'],
    ])(
      'rejects %s as workstream owner with 422 owner-not-member',
      async (_name, ownerId) => {
        const response = await createRequest()
          .post(`/projects/${fixture.projectId}/workstreams`)
          .set('Authorization', authA)
          .send({ name: 'Music', icon: '🎶', ownerId: ownerId() })
          .expect(422);

        expect((response.body as { type: string }).type).toMatch(
          /\/errors\/owner-not-member$/,
        );
      },
    );

    it('rejects a non-member as step owner with 422 owner-not-member', async () => {
      const response = await createRequest()
        .patch(`/steps/${fixture.futureStepIds[0]}`)
        .set('Authorization', authA)
        .send({ ownerId: fixture.actorBUserId })
        .expect(422);

      expect((response.body as { type: string }).type).toMatch(
        /\/errors\/owner-not-member$/,
      );
    });
  });
});
