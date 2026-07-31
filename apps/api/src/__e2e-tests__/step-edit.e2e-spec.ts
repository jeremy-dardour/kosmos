import request from 'supertest';

import { createTestApp } from '@/__e2e-tests__/helpers/create-app.helper';
import { MockTokenFactory } from '@/__e2e-tests__/helpers/mock-token.factory';
import {
  resetDatabase,
  testEntityManager,
} from '@/__e2e-tests__/helpers/reset-database.helper';
import { MockOidcService } from '@/__e2e-tests__/mocks/mock-oidc.service';
import { Note } from '@/database/entities/note.entity';
import { Project } from '@/database/entities/project.entity';
import { Step, StepOutcome } from '@/database/entities/step.entity';
import { User } from '@/database/entities/user.entity';
import { Workstream } from '@/database/entities/workstream.entity';

import type { StepDto } from '@/modules/project/dtos/output/step.dto';
import type { WorkstreamDto } from '@/modules/project/dtos/output/workstream.dto';
import type { SqlEntityManager } from '@mikro-orm/postgresql';
import type { INestApplication } from '@nestjs/common';

const errorType = (slug: string): string =>
  `https://api.example.com/errors/${slug}`;

describe('Step editing E2E Tests', () => {
  const mockOidc = new MockOidcService();
  let tokenFactory: MockTokenFactory;
  let app: INestApplication;
  let em: SqlEntityManager;
  let authorization: string;

  beforeAll(async () => {
    await mockOidc.setup();
    tokenFactory = new MockTokenFactory(mockOidc, process.env.AUTH_CLIENT_ID!);
  });

  beforeEach(async () => {
    app = await createTestApp({ oidcOverride: mockOidc });
    em = testEntityManager(app);
    authorization = `Bearer ${await tokenFactory.validToken()}`;
    await resetDatabase(em);
  });

  afterEach(async () => {
    await app.close();
  });

  /** A three-step pipeline: past (done), current, future. */
  async function createStartedWorkstream(): Promise<{
    workstream: Workstream;
    past: Step;
    current: Step;
    future: Step;
  }> {
    const project = em.create(Project, { name: 'Wedding Prep' });
    const workstream = em.create(Workstream, {
      project,
      position: 0,
      name: 'Venue',
      icon: '🏛️',
      startedAt: new Date('2026-07-01T00:00:00.000Z'),
    });
    const past = em.create(Step, {
      workstream,
      position: 1,
      name: 'Research venues',
      outcome: StepOutcome.Done,
      outcomeAt: new Date('2026-07-02T00:00:00.000Z'),
    });
    const current = em.create(Step, {
      workstream,
      position: 2,
      name: 'Tour venues',
    });
    const future = em.create(Step, {
      workstream,
      position: 3,
      name: 'Sign contract',
    });
    await em.flush();
    workstream.currentStep = current;
    await em.flush();

    return { workstream, past, current, future };
  }

  async function createNotStartedWorkstream(): Promise<{
    workstream: Workstream;
    steps: Step[];
  }> {
    const project = em.create(Project, { name: 'Wedding Prep' });
    const workstream = em.create(Workstream, {
      project,
      position: 0,
      name: 'Flowers',
      icon: '💐',
    });
    const steps = ['Find florist', 'Choose bouquets'].map((name, index) =>
      em.create(Step, { workstream, position: index + 1, name }),
    );
    await em.flush();

    return { workstream, steps };
  }

  describe('POST /workstreams/:id/steps', () => {
    it('inserts a step and shifts the following ones down', async () => {
      const { workstream } = await createNotStartedWorkstream();

      const response = await request(app.getHttpServer() as never)
        .post(`/workstreams/${workstream.id}/steps`)
        .set('Authorization', authorization)
        .send({ name: 'Compare quotes', position: 2 })
        .expect(201);

      const body = response.body as WorkstreamDto;
      expect(
        body.steps.map(({ name, position }) => ({ name, position })),
      ).toEqual([
        { name: 'Find florist', position: 1 },
        { name: 'Compare quotes', position: 2 },
        { name: 'Choose bouquets', position: 3 },
      ]);
      expect(body.steps[1]).toMatchObject({
        status: 'not_started',
        blocked: false,
        deadline: null,
        explicitOwnerId: null,
        effectiveOwnerId: null,
        checklistItems: [],
        noteCount: 0,
      });
    });

    it('accepts a deadline and an explicit owner after the current step', async () => {
      const owner = em.create(User, {
        email: 'owner@example.com',
        name: 'Owner',
      });
      const { workstream } = await createStartedWorkstream();
      await em.flush();

      const response = await request(app.getHttpServer() as never)
        .post(`/workstreams/${workstream.id}/steps`)
        .set('Authorization', authorization)
        .send({
          name: 'Pay deposit',
          position: 3,
          deadline: '2026-08-15',
          ownerId: owner.id,
        })
        .expect(201);

      const body = response.body as WorkstreamDto;
      expect(
        body.steps.map(({ name, position }) => ({ name, position })),
      ).toEqual([
        { name: 'Research venues', position: 1 },
        { name: 'Tour venues', position: 2 },
        { name: 'Pay deposit', position: 3 },
        { name: 'Sign contract', position: 4 },
      ]);
      expect(body.steps[2]).toMatchObject({
        deadline: '2026-08-15',
        explicitOwnerId: owner.id,
        effectiveOwnerId: owner.id,
      });
      expect(body.nearestDeadlineStepId).toBe(body.steps[2]?.id);
    });

    it('rejects a position at or before the current step', async () => {
      const { workstream } = await createStartedWorkstream();

      const response = await request(app.getHttpServer() as never)
        .post(`/workstreams/${workstream.id}/steps`)
        .set('Authorization', authorization)
        .send({ name: 'Rewrite history', position: 2 })
        .expect(409);

      expect(response.body).toMatchObject({
        type: errorType('step-insertion-illegal'),
      });
    });

    it('rejects a position that would leave a gap', async () => {
      const { workstream } = await createNotStartedWorkstream();

      await request(app.getHttpServer() as never)
        .post(`/workstreams/${workstream.id}/steps`)
        .set('Authorization', authorization)
        .send({ name: 'Too far', position: 5 })
        .expect(409);
    });

    it('rejects any insertion into a complete workstream', async () => {
      const { workstream, current, future } = await createStartedWorkstream();
      workstream.currentStep = null;
      workstream.completedAt = new Date();
      for (const step of [current, future]) {
        step.outcome = StepOutcome.Done;
        step.outcomeAt = new Date();
      }
      await em.flush();

      const response = await request(app.getHttpServer() as never)
        .post(`/workstreams/${workstream.id}/steps`)
        .set('Authorization', authorization)
        .send({ name: 'One more thing', position: 4 })
        .expect(409);

      expect(response.body).toMatchObject({
        type: errorType('step-insertion-illegal'),
      });
    });

    it('rejects an empty name and a position below one', async () => {
      const { workstream } = await createNotStartedWorkstream();

      await request(app.getHttpServer() as never)
        .post(`/workstreams/${workstream.id}/steps`)
        .set('Authorization', authorization)
        .send({ name: '', position: 1 })
        .expect(422);

      await request(app.getHttpServer() as never)
        .post(`/workstreams/${workstream.id}/steps`)
        .set('Authorization', authorization)
        .send({ name: 'Zero', position: 0 })
        .expect(422);
    });
  });

  describe('PATCH /steps/:id', () => {
    it('edits the current step and answers with the step alone', async () => {
      const author = em.create(User, {
        email: 'author@example.com',
        name: 'Author',
      });
      const { current } = await createStartedWorkstream();
      em.create(Note, { step: current, author, content: 'Called the venue' });
      await em.flush();

      const response = await request(app.getHttpServer() as never)
        .patch(`/steps/${current.id}`)
        .set('Authorization', authorization)
        .send({
          name: 'Tour shortlisted venues',
          deadline: '2026-08-15',
          ownerId: author.id,
          blocked: true,
        })
        .expect(200);

      expect(response.body as StepDto).toMatchObject({
        id: current.id,
        name: 'Tour shortlisted venues',
        position: 2,
        status: 'in_progress',
        deadline: '2026-08-15',
        explicitOwnerId: author.id,
        effectiveOwnerId: author.id,
        blocked: true,
        noteCount: 1,
      });
    });

    it('clears the deadline and restores owner inheritance on null', async () => {
      const workstreamOwner = em.create(User, {
        email: 'ws-owner@example.com',
        name: 'Workstream owner',
      });
      const stepOwner = em.create(User, {
        email: 'step-owner@example.com',
        name: 'Step owner',
      });
      const { workstream, future } = await createStartedWorkstream();
      workstream.owner = workstreamOwner;
      future.owner = stepOwner;
      future.deadline = '2026-09-01';
      await em.flush();

      const response = await request(app.getHttpServer() as never)
        .patch(`/steps/${future.id}`)
        .set('Authorization', authorization)
        .send({ deadline: null, ownerId: null })
        .expect(200);

      expect(response.body as StepDto).toMatchObject({
        deadline: null,
        explicitOwnerId: null,
        effectiveOwnerId: workstreamOwner.id,
      });
    });

    it('rejects editing a past step', async () => {
      const { past } = await createStartedWorkstream();

      const response = await request(app.getHttpServer() as never)
        .patch(`/steps/${past.id}`)
        .set('Authorization', authorization)
        .send({ name: 'Rewrite history' })
        .expect(409);

      expect(response.body).toMatchObject({ type: errorType('step-frozen') });

      em.clear();
      const unchanged = await em.findOneOrFail(Step, { id: past.id });
      expect(unchanged.name).toBe('Research venues');
    });

    it('rejects an empty or null name', async () => {
      const { current } = await createStartedWorkstream();

      await request(app.getHttpServer() as never)
        .patch(`/steps/${current.id}`)
        .set('Authorization', authorization)
        .send({ name: '' })
        .expect(422);

      await request(app.getHttpServer() as never)
        .patch(`/steps/${current.id}`)
        .set('Authorization', authorization)
        .send({ name: null })
        .expect(422);
    });
  });

  describe('DELETE /steps/:id', () => {
    it('deletes a future step and renumbers the rest', async () => {
      const { workstream, future } = await createStartedWorkstream();
      const trailing = em.create(Step, {
        workstream,
        position: 4,
        name: 'Pay deposit',
      });
      await em.flush();

      const response = await request(app.getHttpServer() as never)
        .delete(`/steps/${future.id}`)
        .set('Authorization', authorization)
        .expect(200);

      const body = response.body as WorkstreamDto;
      expect(body.steps.map(({ id, position }) => ({ id, position }))).toEqual([
        { id: expect.any(String) as string, position: 1 },
        { id: expect.any(String) as string, position: 2 },
        { id: trailing.id, position: 3 },
      ]);
      expect(body.steps.some((step) => step.id === future.id)).toBe(false);
    });

    it('rejects deleting the current step', async () => {
      const { current } = await createStartedWorkstream();

      const response = await request(app.getHttpServer() as never)
        .delete(`/steps/${current.id}`)
        .set('Authorization', authorization)
        .expect(409);

      expect(response.body).toMatchObject({
        type: errorType('step-not-deletable'),
      });
    });

    it('rejects deleting a past step', async () => {
      const { past } = await createStartedWorkstream();

      const response = await request(app.getHttpServer() as never)
        .delete(`/steps/${past.id}`)
        .set('Authorization', authorization)
        .expect(409);

      expect(response.body).toMatchObject({ type: errorType('step-frozen') });

      em.clear();
      await expect(
        em.findOneOrFail(Step, { id: past.id }),
      ).resolves.toBeTruthy();
    });
  });
});
