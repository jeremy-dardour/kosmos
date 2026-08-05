import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import request from 'supertest';

import { createTestApp } from '@/__e2e-tests__/helpers/create-app.helper';
import { MockTokenFactory } from '@/__e2e-tests__/helpers/mock-token.factory';
import {
  resetDatabase,
  testEntityManager,
} from '@/__e2e-tests__/helpers/reset-database.helper';
import { signIn } from '@/__e2e-tests__/helpers/sign-in.helper';
import { MockOidcService } from '@/__e2e-tests__/mocks/mock-oidc.service';
import { IS_PUBLIC_KEY, SKIP_USER_RESOLUTION_KEY } from '@/app/auth/decorators';
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
 * The tenancy sweep (#54, extended for #55): three actors — the owner
 * (tenant A), a joined non-owner member (tenant C), a non-member (tenant B) —
 * and every route asserted route-by-route. The non-member gets a 404
 * indistinguishable from a nonexistent id, and a soft-deleted project 404s
 * even for its owner.
 *
 * Pattern for later tickets: each route is one entry in `ROUTES`, described
 * by how to issue it against the shared fixture and the expected statuses.
 * Both the non-member matrix and the soft-deleted matrix iterate the same
 * table, so a new route added there is automatically swept by both. Feature
 * specs stay the proof of member-path behavior; this spec only proves the
 * authorization boundary.
 */

const TENANT_A_EMAIL = 'tenant-a@example.com';
const TENANT_B_EMAIL = 'tenant-b@example.com';
const TENANT_C_EMAIL = 'tenant-c@example.com';
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
  pendingMemberId: string;
  tenantCMemberId: string;
  tenantAUserId: string;
  tenantBUserId: string;
  tenantCUserId: string;
}

interface RouteCase {
  name: string;
  issue: (agent: TestAgent<SuperTestType>, fixture: Fixture) => SuperTestType;
  /** Expected for the owner (tenant A), asserted last. */
  ownerStatus: number;
  /**
   * Expected for the joined non-owner member (tenant C). Set on routes where
   * the member outcome differs from the owner's (governance 403s) or where
   * any-member access is the contract; asserted before the owner's call so a
   * rejected attempt cannot consume the fixture.
   */
  memberStatus?: number;
  /**
   * Expected for the owner once the project is soft-deleted. Defaults to 404
   * — restore is the one route that must succeed on a deleted project.
   */
  deletedOwnerStatus?: number;
}

const ROUTES: readonly RouteCase[] = [
  {
    name: 'GET /projects/:id',
    issue: (agent, f) => agent.get(`/projects/${f.projectId}`),
    ownerStatus: 200,
  },
  {
    name: 'PATCH /projects/:id',
    issue: (agent, f) =>
      agent.patch(`/projects/${f.projectId}`).send({ name: 'Renamed' }),
    ownerStatus: 200,
  },
  {
    name: 'GET /projects/:projectId/overview',
    issue: (agent, f) => agent.get(`/projects/${f.projectId}/overview`),
    ownerStatus: 200,
  },
  {
    name: 'GET /projects/:projectId/groups',
    issue: (agent, f) => agent.get(`/projects/${f.projectId}/groups`),
    ownerStatus: 200,
  },
  {
    name: 'POST /projects/:projectId/groups',
    issue: (agent, f) =>
      agent
        .post(`/projects/${f.projectId}/groups`)
        .send({ name: 'New group', color: '#5a9e6f' }),
    ownerStatus: 201,
  },
  {
    name: 'PUT /projects/:projectId/group-order',
    issue: (agent, f) =>
      agent
        .put(`/projects/${f.projectId}/group-order`)
        .send({ ids: [f.groupId] }),
    ownerStatus: 200,
  },
  {
    name: 'PATCH /groups/:id',
    issue: (agent, f) =>
      agent.patch(`/groups/${f.groupId}`).send({ name: 'Renamed' }),
    ownerStatus: 200,
  },
  {
    name: 'DELETE /groups/:id',
    issue: (agent, f) => agent.delete(`/groups/${f.groupId}`),
    ownerStatus: 204,
  },
  {
    name: 'POST /projects/:projectId/workstreams',
    issue: (agent, f) =>
      agent
        .post(`/projects/${f.projectId}/workstreams`)
        .send({ name: 'Flowers', icon: '💐' }),
    ownerStatus: 201,
  },
  {
    name: 'PUT /projects/:projectId/workstream-order',
    issue: (agent, f) =>
      agent.put(`/projects/${f.projectId}/workstream-order`).send({
        groupId: null,
        ids: [f.freshWorkstreamId, f.activeWorkstreamId],
      }),
    ownerStatus: 200,
  },
  {
    name: 'PATCH /workstreams/:id',
    issue: (agent, f) =>
      agent
        .patch(`/workstreams/${f.activeWorkstreamId}`)
        .send({ name: 'Renamed' }),
    ownerStatus: 200,
  },
  {
    name: 'POST /workstreams/:id/advance',
    issue: (agent, f) =>
      agent.post(`/workstreams/${f.activeWorkstreamId}/advance`).send({}),
    ownerStatus: 200,
  },
  {
    name: 'POST /workstreams/:id/steps',
    issue: (agent, f) =>
      agent
        .post(`/workstreams/${f.activeWorkstreamId}/steps`)
        .send({ name: 'Appended', position: 5 }),
    ownerStatus: 201,
  },
  {
    name: 'PUT /workstreams/:id/step-order',
    issue: (agent, f) =>
      agent.put(`/workstreams/${f.activeWorkstreamId}/step-order`).send({
        ids: [f.futureStepIds[1], f.futureStepIds[0]],
      }),
    ownerStatus: 200,
  },
  {
    name: 'DELETE /workstreams/:id',
    issue: (agent, f) => agent.delete(`/workstreams/${f.freshWorkstreamId}`),
    ownerStatus: 204,
  },
  {
    name: 'GET /workstreams/:workstreamId/notes',
    issue: (agent, f) =>
      agent.get(`/workstreams/${f.activeWorkstreamId}/notes`),
    ownerStatus: 200,
  },
  {
    name: 'PATCH /steps/:id',
    issue: (agent, f) =>
      agent.patch(`/steps/${f.futureStepIds[0]}`).send({ name: 'Renamed' }),
    ownerStatus: 200,
  },
  {
    name: 'DELETE /steps/:id',
    issue: (agent, f) => agent.delete(`/steps/${f.futureStepIds[0]}`),
    ownerStatus: 200,
  },
  {
    name: 'POST /steps/:stepId/checklist-items',
    issue: (agent, f) =>
      agent
        .post(`/steps/${f.currentStepId}/checklist-items`)
        .send({ name: 'Sub-task' }),
    ownerStatus: 201,
  },
  {
    name: 'PATCH /checklist-items/:id',
    issue: (agent, f) =>
      agent
        .patch(`/checklist-items/${f.checklistItemId}`)
        .send({ name: 'Renamed' }),
    ownerStatus: 200,
  },
  {
    name: 'DELETE /checklist-items/:id',
    issue: (agent, f) => agent.delete(`/checklist-items/${f.checklistItemId}`),
    ownerStatus: 204,
  },
  {
    name: 'POST /steps/:stepId/notes',
    issue: (agent, f) =>
      agent.post(`/steps/${f.currentStepId}/notes`).send({ content: 'Hello' }),
    ownerStatus: 201,
  },
  {
    name: 'PATCH /notes/:id',
    issue: (agent, f) =>
      agent.patch(`/notes/${f.noteId}`).send({ content: 'Edited' }),
    ownerStatus: 200,
  },
  {
    name: 'DELETE /notes/:id',
    issue: (agent, f) => agent.delete(`/notes/${f.noteId}`),
    ownerStatus: 204,
  },
  {
    name: 'GET /projects/:projectId/members',
    issue: (agent, f) => agent.get(`/projects/${f.projectId}/members`),
    ownerStatus: 200,
    memberStatus: 200,
  },
  {
    name: 'POST /projects/:projectId/members',
    issue: (agent, f) =>
      agent
        .post(`/projects/${f.projectId}/members`)
        .send({ email: 'sweep-invitee@example.com' }),
    ownerStatus: 201,
    memberStatus: 403,
  },
  {
    name: 'DELETE /projects/:projectId/members/:memberId',
    issue: (agent, f) =>
      agent.delete(`/projects/${f.projectId}/members/${f.pendingMemberId}`),
    ownerStatus: 204,
    memberStatus: 403,
  },
  {
    name: 'POST /projects/:id/transfer-ownership',
    issue: (agent, f) =>
      agent
        .post(`/projects/${f.projectId}/transfer-ownership`)
        .send({ memberId: f.tenantCMemberId }),
    ownerStatus: 200,
    memberStatus: 403,
  },
  {
    name: 'DELETE /projects/:id',
    issue: (agent, f) => agent.delete(`/projects/${f.projectId}`),
    ownerStatus: 204,
    memberStatus: 403,
  },
  {
    // On a live project the owner gets 409 project-not-deleted; on the
    // soft-deleted axis this is the one route that must succeed.
    name: 'POST /projects/:id/restore',
    issue: (agent, f) => agent.post(`/projects/${f.projectId}/restore`),
    ownerStatus: 409,
    memberStatus: 403,
    deletedOwnerStatus: 200,
  },
];

describe('Tenancy Enforcement E2E Tests', () => {
  const mockOidc = new MockOidcService();
  let tokenFactory: MockTokenFactory;
  let app: INestApplication;
  let em: SqlEntityManager;
  let authA: string;
  let authB: string;
  let authC: string;
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
    authC = `Bearer ${await tokenFactory.createToken({ email: TENANT_C_EMAIL })}`;
    const userA = await signIn(app, authA);
    const userB = await signIn(app, authB);
    const userC = await signIn(app, authC);

    fixture = await buildFixture(userA.id, userB.id, userC.id);
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
   * Project A (owner: user A, joined non-owner member: user C) with a group,
   * a started workstream carrying past/current/future steps, a checklist
   * item, a note by A and a pending invite; plus B's own project so the
   * non-member is a fully valid current user.
   */
  async function buildFixture(
    tenantAUserId: string,
    tenantBUserId: string,
    tenantCUserId: string,
  ): Promise<Fixture> {
    const projectId = await createProjectAs(authA, 'Tenant A Wedding');
    await createProjectAs(authB, 'Tenant B Wedding');

    const project = await em.findOneOrFail(Project, { id: projectId });
    const tenantA = await em.findOneOrFail(User, { id: tenantAUserId });
    const tenantC = await em.findOneOrFail(User, { id: tenantCUserId });

    const tenantCMember = em.create(ProjectMember, {
      project,
      email: TENANT_C_EMAIL,
      user: tenantC,
    });
    const pendingMember = em.create(ProjectMember, {
      project,
      email: PENDING_EMAIL,
      user: null,
    });

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
      author: tenantA,
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
      pendingMemberId: pendingMember.id,
      tenantCMemberId: tenantCMember.id,
      tenantAUserId,
      tenantBUserId,
      tenantCUserId,
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

        if (route.memberStatus !== undefined) {
          await route
            .issue(createRequest(), fixture)
            .set('Authorization', authC)
            .expect(route.memberStatus);
        }

        await route
          .issue(createRequest(), fixture)
          .set('Authorization', authA)
          .expect(route.ownerStatus);
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
          .expect(route.deletedOwnerStatus ?? 404);
      },
    );
  });

  describe('users directory and owner assignment', () => {
    it('lists only referenced owners in the overview users directory', async () => {
      const response = await createRequest()
        .get(`/projects/${fixture.projectId}/overview`)
        .set('Authorization', authA)
        .expect(200);

      // The project owner is the sole owner reference in the fixture: joined
      // but unassigned members (tenant C) stay out, as does any other tenant.
      const users = (response.body as { users: { id: string }[] }).users;
      expect(users.map((user) => user.id)).toEqual([fixture.tenantAUserId]);
    });

    it('accepts a joined member as workstream owner', async () => {
      await createRequest()
        .post(`/projects/${fixture.projectId}/workstreams`)
        .set('Authorization', authA)
        .send({ name: 'Music', icon: '🎶', ownerId: fixture.tenantAUserId })
        .expect(201);
    });

    it.each([
      ['a non-member user', () => fixture.tenantBUserId],
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
        .send({ ownerId: fixture.tenantBUserId })
        .expect(422);

      expect((response.body as { type: string }).type).toMatch(
        /\/errors\/owner-not-member$/,
      );
    });
  });

  describe('sweep coverage', () => {
    /**
     * Routes deliberately outside the non-member 404 matrix. Adding a route
     * here needs the same justification as these: either it exposes no
     * project-scoped resource, or its tenancy proof lives in a feature spec.
     */
    const EXEMPT = new Set([
      // Membership-scoped list/create — no per-id 404 to assert; scoping is
      // proven in project-tenancy.e2e-spec.ts.
      'GET /projects',
      'POST /projects',
      // Dev-only static info, no tenant data.
      'GET /.well-known/swagger-credentials',
    ]);

    it('covers every guarded route in the non-member matrix', () => {
      const swept = new Set(ROUTES.map((route) => route.name));
      const missing = listGuardedRoutes(app).filter(
        (route) => !swept.has(route) && !EXEMPT.has(route),
      );

      expect(missing).toEqual([]);
    });
  });
});

/**
 * Every registered route that runs with an authenticated, resolved user —
 * i.e. everything not opted out via `@Public()` or `@SkipUserResolution()`.
 * Read from controller metadata so a new route fails this sweep until it is
 * added to `ROUTES` (or deliberately exempted above).
 */
type ControllerClass = (new () => unknown) & {
  prototype: Record<string, unknown>;
};

function listGuardedRoutes(application: INestApplication): string[] {
  const routes: string[] = [];

  for (const module of application.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      routes.push(
        ...guardedRoutesOf(wrapper.metatype as ControllerClass | undefined),
      );
    }
  }

  return routes;
}

function guardedRoutesOf(controller: ControllerClass | undefined): string[] {
  if (!controller?.prototype || isOptedOut(controller)) {
    return [];
  }

  const basePath = readMetadata<string>(PATH_METADATA, controller) ?? '';

  return Object.getOwnPropertyNames(controller.prototype).flatMap((name) => {
    const handler = controller.prototype[name];
    if (typeof handler !== 'function' || name === 'constructor') {
      return [];
    }
    const path = readMetadata<string>(PATH_METADATA, handler);
    const method = readMetadata<number>(METHOD_METADATA, handler);
    if (path === undefined || method === undefined || isOptedOut(handler)) {
      return [];
    }

    const fullPath = `/${basePath}/${path}`
      .replaceAll(/\/+/g, '/')
      .replace(/\/$/, '');

    return [`${RequestMethod[method]} ${fullPath || '/'}`];
  });
}

function isOptedOut(target: object): boolean {
  return (
    readMetadata<boolean>(IS_PUBLIC_KEY, target) === true ||
    readMetadata<boolean>(SKIP_USER_RESOLUTION_KEY, target) === true
  );
}

function readMetadata<T>(key: string, target: object): T | undefined {
  // eslint-disable-next-line unicorn/no-nonstandard-builtin-properties -- reflect-metadata is loaded by Nest
  return Reflect.getMetadata(key, target) as T | undefined;
}
