import request from 'supertest';

import { createTestApp } from '@/__e2e-tests__/helpers/create-app.helper';
import { MockTokenFactory } from '@/__e2e-tests__/helpers/mock-token.factory';
import {
  resetDatabase,
  testEntityManager,
} from '@/__e2e-tests__/helpers/reset-database.helper';
import { MockOidcService } from '@/__e2e-tests__/mocks/mock-oidc.service';
import { Step } from '@/database/entities/step.entity';
import { User } from '@/database/entities/user.entity';
import { Workstream } from '@/database/entities/workstream.entity';
import { calendarDay } from '@/shared/utils/calendar-day';

import type { GroupDto } from '@/modules/project/dtos/output/group.dto';
import type { ProjectDto } from '@/modules/project/dtos/output/project.dto';
import type { WorkstreamDto } from '@/modules/project/dtos/output/workstream.dto';
import type { SqlEntityManager } from '@mikro-orm/postgresql';
import type { INestApplication } from '@nestjs/common';
import type { Test as SuperTestType } from 'supertest';
import type TestAgent from 'supertest/lib/agent';

function createRequest(app: INestApplication): TestAgent<SuperTestType> {
  return request(app.getHttpServer() as never);
}

/** Steps have no endpoints yet (slice 6), so pipelines are written directly. */
describe('Project CRUD E2E Tests', () => {
  const mockOidc = new MockOidcService();
  let tokenFactory: MockTokenFactory;
  let app: INestApplication;
  let em: SqlEntityManager;
  let auth: string;

  beforeAll(async () => {
    await mockOidc.setup();
    tokenFactory = new MockTokenFactory(mockOidc, process.env.AUTH_CLIENT_ID!);
  });

  beforeEach(async () => {
    app = await createTestApp({ oidcOverride: mockOidc });
    em = testEntityManager(app);
    auth = `Bearer ${await tokenFactory.validToken()}`;

    await resetDatabase(em);
  });

  afterEach(async () => {
    await app.close();
  });

  async function createProject(eventDate?: string | null): Promise<ProjectDto> {
    const response = await createRequest(app)
      .post('/projects')
      .set('Authorization', auth)
      .send({ name: 'Wedding Prep', eventDate })
      .expect(201);

    return response.body as ProjectDto;
  }

  async function createGroup(projectId: string): Promise<GroupDto> {
    const response = await createRequest(app)
      .post(`/projects/${projectId}/groups`)
      .set('Authorization', auth)
      .send({ name: 'Vendors', color: '#5a9e6f' })
      .expect(201);

    return response.body as GroupDto;
  }

  describe('Project', () => {
    it('creates a project and lists it', async () => {
      const created = await createProject(calendarDay(120));

      expect(created).toMatchObject({
        name: 'Wedding Prep',
        eventDate: calendarDay(120),
      });

      const list = await createRequest(app)
        .get('/projects')
        .set('Authorization', auth)
        .expect(200);

      expect(list.body).toHaveLength(1);
    });

    it('creates a project without an event date', async () => {
      const created = await createProject();

      expect(created.eventDate).toBeNull();
    });

    it('reads a single project', async () => {
      const created = await createProject();

      const response = await createRequest(app)
        .get(`/projects/${created.id}`)
        .set('Authorization', auth)
        .expect(200);

      expect((response.body as ProjectDto).id).toBe(created.id);
    });

    it('updates the name and event date', async () => {
      const created = await createProject();

      const response = await createRequest(app)
        .patch(`/projects/${created.id}`)
        .set('Authorization', auth)
        .send({ name: 'Renamed', eventDate: calendarDay(200) })
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'Renamed',
        eventDate: calendarDay(200),
      });
    });

    it('clears the event date when passed null', async () => {
      const created = await createProject(calendarDay(30));

      const response = await createRequest(app)
        .patch(`/projects/${created.id}`)
        .set('Authorization', auth)
        .send({ eventDate: null })
        .expect(200);

      expect((response.body as ProjectDto).eventDate).toBeNull();
    });

    it('rejects an event date that is not a calendar day', async () => {
      await createRequest(app)
        .post('/projects')
        .set('Authorization', auth)
        .send({ name: 'Wedding Prep', eventDate: '2026-07-25T10:00:00Z' })
        .expect(422);
    });

    it('rejects an impossible date', async () => {
      await createRequest(app)
        .post('/projects')
        .set('Authorization', auth)
        .send({ name: 'Wedding Prep', eventDate: '2026-13-45' })
        .expect(422);
    });

    it('rejects unknown properties', async () => {
      await createRequest(app)
        .post('/projects')
        .set('Authorization', auth)
        .send({ name: 'Wedding Prep', surprise: true })
        .expect(422);
    });

    it('rejects null on a required field', async () => {
      const created = await createProject();

      await createRequest(app)
        .patch(`/projects/${created.id}`)
        .set('Authorization', auth)
        .send({ name: null })
        .expect(422);
    });

    it('returns 404 for an unknown project', async () => {
      await createRequest(app)
        .get('/projects/11111111-1111-4111-8111-111111111111')
        .set('Authorization', auth)
        .expect(404);
    });
  });

  describe('Group', () => {
    it('creates, lists and updates a group', async () => {
      const project = await createProject();
      const group = await createGroup(project.id);

      expect(group).toMatchObject({ name: 'Vendors', color: '#5a9e6f' });

      const list = await createRequest(app)
        .get(`/projects/${project.id}/groups`)
        .set('Authorization', auth)
        .expect(200);

      expect(list.body).toHaveLength(1);

      const updated = await createRequest(app)
        .patch(`/groups/${group.id}`)
        .set('Authorization', auth)
        .send({ color: '#8b6cc1' })
        .expect(200);

      expect(updated.body).toMatchObject({
        name: 'Vendors',
        color: '#8b6cc1',
      });
    });

    it('rejects a colour that is not six-digit hex', async () => {
      const project = await createProject();

      await createRequest(app)
        .post(`/projects/${project.id}/groups`)
        .set('Authorization', auth)
        .send({ name: 'Vendors', color: 'green' })
        .expect(422);
    });

    it('rejects null on a required field', async () => {
      const project = await createProject();
      const group = await createGroup(project.id);

      await createRequest(app)
        .patch(`/groups/${group.id}`)
        .set('Authorization', auth)
        .send({ color: null })
        .expect(422);
    });

    it('ungroups its workstreams when deleted, rather than deleting them', async () => {
      const project = await createProject();
      const group = await createGroup(project.id);

      const workstream = await createWorkstream(project.id, {
        groupId: group.id,
      });
      expect(workstream.groupId).toBe(group.id);

      await createRequest(app)
        .delete(`/groups/${group.id}`)
        .set('Authorization', auth)
        .expect(204);

      const overview = await createRequest(app)
        .get(`/projects/${project.id}/overview`)
        .set('Authorization', auth)
        .expect(200);

      const body = overview.body as {
        groups: unknown[];
        workstreams: unknown[];
      };
      expect(body.groups).toHaveLength(0);
      expect(body.workstreams).toHaveLength(1);
      expect(body.workstreams[0]).toMatchObject({ groupId: null });
    });
  });

  async function createWorkstream(
    projectId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<WorkstreamDto> {
    const response = await createRequest(app)
      .post(`/projects/${projectId}/workstreams`)
      .set('Authorization', auth)
      .send({ name: 'Catering', icon: '🍽️', ...overrides })
      .expect(201);

    return response.body as WorkstreamDto;
  }

  describe('Workstream', () => {
    it('creates a workstream as not started, with no steps', async () => {
      const project = await createProject();

      const workstream = await createWorkstream(project.id);

      expect(workstream).toMatchObject({
        name: 'Catering',
        icon: '🍽️',
        lifecycle: 'not_started',
        groupId: null,
        owner: null,
        currentStepId: null,
        startedAt: null,
        completedAt: null,
        steps: [],
      });
    });

    it('creates a workstream with a group and an owner', async () => {
      const project = await createProject();
      const group = await createGroup(project.id);
      const owner = em.create(User, {
        email: 'owner@example.com',
        name: 'Owner One',
        avatarUrl: null,
      });
      await em.flush();

      const workstream = await createWorkstream(project.id, {
        groupId: group.id,
        ownerId: owner.id,
      });

      expect(workstream.groupId).toBe(group.id);
      expect(workstream.owner).toMatchObject({ name: 'Owner One' });
    });

    it('refuses a group belonging to another project', async () => {
      const project = await createProject();
      const otherProject = await createProject();
      const foreignGroup = await createGroup(otherProject.id);

      await createRequest(app)
        .post(`/projects/${project.id}/workstreams`)
        .set('Authorization', auth)
        .send({ name: 'Catering', icon: '🍽️', groupId: foreignGroup.id })
        .expect(404);
    });

    it('updates the name, icon and group', async () => {
      const project = await createProject();
      const group = await createGroup(project.id);
      const workstream = await createWorkstream(project.id);

      const response = await createRequest(app)
        .patch(`/workstreams/${workstream.id}`)
        .set('Authorization', auth)
        .send({ name: 'Food & Drink', icon: '🥂', groupId: group.id })
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'Food & Drink',
        icon: '🥂',
        groupId: group.id,
      });
    });

    it('ungroups and unassigns when passed null', async () => {
      const project = await createProject();
      const group = await createGroup(project.id);
      const owner = em.create(User, {
        email: 'owner@example.com',
        name: 'Owner One',
        avatarUrl: null,
      });
      await em.flush();

      const workstream = await createWorkstream(project.id, {
        groupId: group.id,
        ownerId: owner.id,
      });

      const response = await createRequest(app)
        .patch(`/workstreams/${workstream.id}`)
        .set('Authorization', auth)
        .send({ groupId: null, ownerId: null })
        .expect(200);

      expect(response.body).toMatchObject({ groupId: null, owner: null });
    });

    it('rejects null on a required field', async () => {
      const project = await createProject();
      const workstream = await createWorkstream(project.id);

      await createRequest(app)
        .patch(`/workstreams/${workstream.id}`)
        .set('Authorization', auth)
        .send({ icon: null })
        .expect(422);
    });

    it('deletes a workstream and cascades its pipeline', async () => {
      const project = await createProject();
      const created = await createWorkstream(project.id);

      const workstream = await em.findOneOrFail(Workstream, {
        id: created.id,
      });
      const step = em.create(Step, {
        workstream,
        position: 1,
        name: 'Request quotes',
      });
      await em.flush();
      workstream.startedAt = new Date();
      workstream.currentStep = step;
      await em.flush();

      await createRequest(app)
        .delete(`/workstreams/${created.id}`)
        .set('Authorization', auth)
        .expect(204);

      expect(await em.count(Workstream, { id: created.id })).toBe(0);
      expect(await em.count(Step, { id: step.id })).toBe(0);
    });

    it('returns a resolved step owner and note count on the mutation response', async () => {
      const project = await createProject();
      const owner = em.create(User, {
        email: 'owner@example.com',
        name: 'Owner One',
        avatarUrl: null,
      });
      await em.flush();

      const created = await createWorkstream(project.id, { ownerId: owner.id });

      const workstream = await em.findOneOrFail(Workstream, {
        id: created.id,
      });
      em.create(Step, {
        workstream,
        position: 1,
        name: 'Request quotes',
        notes: [{ content: 'Chased them today.', author: owner }],
      });
      await em.flush();

      const response = await createRequest(app)
        .patch(`/workstreams/${created.id}`)
        .set('Authorization', auth)
        .send({ name: 'Catering & Bar' })
        .expect(200);

      const body = response.body as WorkstreamDto;
      expect(body.steps).toHaveLength(1);
      expect(body.steps[0]).toMatchObject({
        status: 'not_started',
        noteCount: 1,
      });
      expect(body.steps[0]?.owner).toMatchObject({ name: 'Owner One' });
    });

    it('returns 401 without a token', async () => {
      const project = await createProject();

      await createRequest(app)
        .post(`/projects/${project.id}/workstreams`)
        .send({ name: 'Catering', icon: '🍽️' })
        .expect(401);
    });
  });
});
