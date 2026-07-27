import request from 'supertest';

import { createTestApp } from '@/__e2e-tests__/helpers/create-app.helper';
import { MockTokenFactory } from '@/__e2e-tests__/helpers/mock-token.factory';
import {
  resetDatabase,
  testEntityManager,
} from '@/__e2e-tests__/helpers/reset-database.helper';
import { MockOidcService } from '@/__e2e-tests__/mocks/mock-oidc.service';
import { Group } from '@/database/entities/group.entity';
import { Project } from '@/database/entities/project.entity';
import { Step, StepOutcome } from '@/database/entities/step.entity';
import { User } from '@/database/entities/user.entity';
import { Workstream } from '@/database/entities/workstream.entity';
import { calendarDay, instantAt } from '@/shared/utils/calendar-day';

import type { OverviewDto } from '@/modules/project/dtos/output/overview.dto';
import type { SqlEntityManager } from '@mikro-orm/postgresql';
import type { INestApplication } from '@nestjs/common';
import type { Test as SuperTestType } from 'supertest';
import type TestAgent from 'supertest/lib/agent';

function createRequest(app: INestApplication): TestAgent<SuperTestType> {
  return request(app.getHttpServer() as never);
}

describe('Overview E2E Tests', () => {
  const mockOidc = new MockOidcService();
  let tokenFactory: MockTokenFactory;
  let app: INestApplication;
  let em: SqlEntityManager;
  let token: string;

  let projectId: string;
  let completedId: string;
  let activeId: string;
  let notStartedId: string;
  let workstreamOwnerId: string;
  let stepOwnerId: string;
  let activeDeadlineStepId: string;
  let notStartedDeadlineStepId: string;

  beforeAll(async () => {
    await mockOidc.setup();
    tokenFactory = new MockTokenFactory(mockOidc, process.env.AUTH_CLIENT_ID!);
  });

  beforeEach(async () => {
    app = await createTestApp({ oidcOverride: mockOidc });
    em = testEntityManager(app);
    token = await tokenFactory.validToken();

    await resetDatabase(em);
    await seedFixture();
  });

  afterEach(async () => {
    await app.close();
  });

  /** One workstream per lifecycle state, covering every step status. */
  async function seedFixture(): Promise<void> {
    const workstreamOwner = em.create(User, {
      email: 'workstream-owner@example.com',
      name: 'Workstream Owner',
      avatarUrl: 'https://example.com/ws-owner.png',
    });
    const stepOwner = em.create(User, {
      email: 'step-owner@example.com',
      name: 'Step Owner',
      avatarUrl: null,
    });

    const project = em.create(Project, {
      name: 'Wedding Prep',
      eventDate: calendarDay(10),
    });

    const group = em.create(Group, {
      project,
      name: 'Vendors',
      color: '#5a9e6f',
    });

    const completed = em.create(Workstream, {
      project,
      group,
      owner: workstreamOwner,
      name: 'Venue',
      icon: '🏛️',
      startedAt: instantAt(-100),
      completedAt: instantAt(-20),
    });
    em.create(Step, {
      workstream: completed,
      position: 1,
      name: 'Shortlist venues',
      outcome: StepOutcome.Done,
      outcomeAt: instantAt(-90),
      deadline: calendarDay(-95),
    });
    em.create(Step, {
      workstream: completed,
      position: 2,
      name: 'Compare quotes',
      outcome: StepOutcome.Skipped,
      outcomeAt: instantAt(-20),
    });

    const active = em.create(Workstream, {
      project,
      owner: workstreamOwner,
      name: 'Catering',
      icon: '🍽️',
      startedAt: instantAt(-30),
    });
    em.create(Step, {
      workstream: active,
      position: 1,
      name: 'Define menu style',
      outcome: StepOutcome.Done,
      outcomeAt: instantAt(-25),
    });
    const currentStep = em.create(Step, {
      workstream: active,
      position: 2,
      name: 'Tasting sessions',
      owner: stepOwner,
      blocked: true,
      deadline: calendarDay(-3),
      checklistItems: [
        { position: 2, name: 'Two Spoons', done: false },
        { position: 1, name: 'Green Fig Kitchen', done: true },
      ],
    });
    em.create(Step, {
      workstream: active,
      position: 3,
      name: 'Choose caterer',
      deadline: calendarDay(8),
    });

    const notStarted = em.create(Workstream, {
      project,
      name: 'Flowers',
      icon: '💐',
    });
    const notStartedDeadlineStep = em.create(Step, {
      workstream: notStarted,
      position: 1,
      name: 'Confirm arrangements',
      deadline: calendarDay(20),
    });

    await em.flush();

    active.currentStep = currentStep;
    await em.flush();

    projectId = project.id;
    completedId = completed.id;
    activeId = active.id;
    notStartedId = notStarted.id;
    workstreamOwnerId = workstreamOwner.id;
    stepOwnerId = stepOwner.id;
    activeDeadlineStepId = currentStep.id;
    notStartedDeadlineStepId = notStartedDeadlineStep.id;
  }

  async function fetchOverview(): Promise<OverviewDto> {
    const response = await createRequest(app)
      .get(`/projects/${projectId}/overview`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    return response.body as OverviewDto;
  }

  describe('GET /projects/:projectId/overview', () => {
    it('returns the project event date without a time-relative copy', async () => {
      const overview = await fetchOverview();

      expect(overview.project).toMatchObject({
        id: projectId,
        name: 'Wedding Prep',
        eventDate: calendarDay(10),
      });
      expect(overview.project.createdAt).toEqual(expect.any(String));
      expect(overview.project.updatedAt).toEqual(expect.any(String));
    });

    it("returns the project's groups", async () => {
      const overview = await fetchOverview();

      expect(overview.groups).toHaveLength(1);
      expect(overview.groups[0]).toMatchObject({
        name: 'Vendors',
        color: '#5a9e6f',
      });
    });

    it('returns every workstream, ordered by name', async () => {
      const overview = await fetchOverview();

      expect(overview.workstreams.map((w) => w.name)).toEqual([
        'Catering',
        'Flowers',
        'Venue',
      ]);
    });

    it('derives the lifecycle of each workstream', async () => {
      const overview = await fetchOverview();

      const lifecycles = new Map(
        overview.workstreams.map((w) => [w.id, w.lifecycle]),
      );

      expect(lifecycles.get(completedId)).toBe('complete');
      expect(lifecycles.get(activeId)).toBe('active');
      expect(lifecycles.get(notStartedId)).toBe('not_started');
    });

    it('reports the recorded outcome as the status of passed steps', async () => {
      const completed = findWorkstream(await fetchOverview(), completedId);

      expect(completed.steps.map((step) => step.status)).toEqual([
        'done',
        'skipped',
      ]);
    });

    it('marks the step at the pointer in progress and later steps not started', async () => {
      const active = findWorkstream(await fetchOverview(), activeId);

      expect(active.steps.map((step) => step.status)).toEqual([
        'done',
        'in_progress',
        'not_started',
      ]);
    });

    it('treats every step of a not-started workstream as not started', async () => {
      const notStarted = findWorkstream(await fetchOverview(), notStartedId);

      expect(notStarted.steps.map((step) => step.status)).toEqual([
        'not_started',
      ]);
    });

    it('carries the blocked flag independently of status', async () => {
      const active = findWorkstream(await fetchOverview(), activeId);

      expect(active.steps[1]).toMatchObject({
        status: 'in_progress',
        blocked: true,
      });
      expect(active.steps[0]?.blocked).toBe(false);
    });

    it("resolves a step's own owner ahead of the workstream default", async () => {
      const active = findWorkstream(await fetchOverview(), activeId);

      expect(active.ownerId).toBe(workstreamOwnerId);
      expect(active.steps[1]).toMatchObject({
        explicitOwnerId: stepOwnerId,
        effectiveOwnerId: stepOwnerId,
      });
    });

    it('preserves owner inheritance without duplicating user data', async () => {
      const active = findWorkstream(await fetchOverview(), activeId);

      expect(active.steps[0]).toMatchObject({
        explicitOwnerId: null,
        effectiveOwnerId: workstreamOwnerId,
      });
    });

    it('leaves steps unassigned when neither the step nor the workstream has an owner', async () => {
      const notStarted = findWorkstream(await fetchOverview(), notStartedId);

      expect(notStarted.ownerId).toBeNull();
      expect(notStarted.steps[0]).toMatchObject({
        explicitOwnerId: null,
        effectiveOwnerId: null,
      });
    });

    it('references the earliest unpassed deadline step', async () => {
      const active = findWorkstream(await fetchOverview(), activeId);

      expect(active.nearestDeadlineStepId).toBe(activeDeadlineStepId);
    });

    it('references a deadline for a workstream not yet started', async () => {
      const notStarted = findWorkstream(await fetchOverview(), notStartedId);

      expect(notStarted.nearestDeadlineStepId).toBe(notStartedDeadlineStepId);
    });

    it('reports no deadline for a completed workstream', async () => {
      const completed = findWorkstream(await fetchOverview(), completedId);

      expect(completed.nearestDeadlineStepId).toBeNull();
    });

    it('inlines checklist items, ordered by position', async () => {
      const active = findWorkstream(await fetchOverview(), activeId);

      expect(active.steps[1]?.checklistItems).toHaveLength(2);
      expect(active.steps[1]?.checklistItems.map((item) => item.name)).toEqual([
        'Green Fig Kitchen',
        'Two Spoons',
      ]);
      expect(active.steps[1]?.checklistItems[0]?.done).toBe(true);
    });

    it('includes the group id on grouped workstreams and null on ungrouped ones', async () => {
      const overview = await fetchOverview();
      const groupId = overview.groups[0]?.id;

      expect(findWorkstream(overview, completedId).groupId).toBe(groupId);
      expect(findWorkstream(overview, activeId).groupId).toBeNull();
    });

    it('includes one canonical summary for every user', async () => {
      const overview = await fetchOverview();

      expect(overview.users).toEqual(
        expect.arrayContaining([
          {
            id: stepOwnerId,
            name: 'Step Owner',
            avatarUrl: null,
          },
          {
            id: workstreamOwnerId,
            name: 'Workstream Owner',
            avatarUrl: 'https://example.com/ws-owner.png',
          },
        ]),
      );
      expect(overview.users[0]).not.toHaveProperty('email');
      expect(overview.users[0]).not.toHaveProperty('createdAt');
    });

    it('returns 404 for an unknown project', async () => {
      await createRequest(app)
        .get(`/projects/11111111-1111-4111-8111-111111111111/overview`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('returns 400 for a malformed project id', async () => {
      await createRequest(app)
        .get('/projects/not-a-uuid/overview')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('returns 401 without a token', async () => {
      await createRequest(app)
        .get(`/projects/${projectId}/overview`)
        .expect(401);
    });
  });
});

function findWorkstream(overview: OverviewDto, id: string) {
  const workstream = overview.workstreams.find((item) => item.id === id);

  if (!workstream) {
    throw new Error(`Workstream ${id} missing from overview`);
  }

  return workstream;
}
