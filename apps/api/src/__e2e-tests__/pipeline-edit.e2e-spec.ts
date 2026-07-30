import request from 'supertest';

import { createTestApp } from '@/__e2e-tests__/helpers/create-app.helper';
import { MockTokenFactory } from '@/__e2e-tests__/helpers/mock-token.factory';
import {
  resetDatabase,
  testEntityManager,
} from '@/__e2e-tests__/helpers/reset-database.helper';
import { MockOidcService } from '@/__e2e-tests__/mocks/mock-oidc.service';
import { Project } from '@/database/entities/project.entity';
import { Step, StepOutcome } from '@/database/entities/step.entity';
import { User } from '@/database/entities/user.entity';
import { Workstream } from '@/database/entities/workstream.entity';

import type { WorkstreamDto } from '@/modules/project/dtos/output/workstream.dto';
import type { SqlEntityManager } from '@mikro-orm/postgresql';
import type { INestApplication } from '@nestjs/common';

describe('Pipeline edit E2E Tests', () => {
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

  it('atomically replaces the editable pipeline of a not-started workstream', async () => {
    const project = em.create(Project, { name: 'Wedding Prep' });
    const workstream = em.create(Workstream, {
      project,
      name: 'Catering',
      icon: '🍽️',
    });
    const existingStep = em.create(Step, {
      workstream,
      position: 1,
      name: 'Find caterers',
    });
    await em.flush();

    const originalUpdatedAt = workstream.updatedAt.toISOString();
    const response = await request(app.getHttpServer() as never)
      .put(`/workstreams/${workstream.id}/pipeline`)
      .set('Authorization', authorization)
      .send({
        expectedUpdatedAt: originalUpdatedAt,
        steps: [
          {
            id: existingStep.id,
            name: 'Compare caterers',
            deadline: null,
            ownerId: null,
            blocked: false,
            checklistItems: [{ name: 'Option A', done: false }],
          },
          {
            name: 'Book caterer',
            deadline: null,
            ownerId: null,
            blocked: false,
            checklistItems: [],
          },
        ],
      });

    expect(response.status, JSON.stringify(response.body)).toBe(200);

    const body = response.body as WorkstreamDto;
    expect(body.updatedAt).not.toBe(originalUpdatedAt);
    expect(body.steps).toHaveLength(2);
    expect(
      body.steps.map(({ name, position }) => ({ name, position })),
    ).toEqual([
      { name: 'Compare caterers', position: 1 },
      { name: 'Book caterer', position: 2 },
    ]);
    expect(body.steps[0]?.checklistItems).toMatchObject([
      { name: 'Option A', position: 1, done: false },
    ]);
  });

  it('keeps past steps frozen while editing current and future steps', async () => {
    const owner = em.create(User, {
      email: 'owner@example.com',
      name: 'Owner',
    });
    const project = em.create(Project, { name: 'Wedding Prep' });
    const workstream = em.create(Workstream, {
      project,
      owner,
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
      checklistItems: [
        { position: 1, name: 'Old first', done: false },
        { position: 2, name: 'Old second', done: true },
      ],
    });
    const removedFuture = em.create(Step, {
      workstream,
      position: 3,
      name: 'Compare venues',
    });
    const retainedFuture = em.create(Step, {
      workstream,
      position: 4,
      name: 'Sign contract',
    });
    await em.flush();
    workstream.currentStep = current;
    await em.flush();
    const [firstItem, secondItem] = [...current.getChecklistItems()].sort(
      (left, right) => left.position - right.position,
    );

    const response = await request(app.getHttpServer() as never)
      .put(`/workstreams/${workstream.id}/pipeline`)
      .set('Authorization', authorization)
      .send({
        expectedUpdatedAt: workstream.updatedAt.toISOString(),
        steps: [
          {
            id: current.id,
            name: 'Tour shortlisted venues',
            deadline: '2026-08-15',
            ownerId: owner.id,
            blocked: true,
            checklistItems: [
              { id: secondItem!.id, name: 'Second first', done: false },
              { id: firstItem!.id, name: 'First second', done: true },
            ],
          },
          {
            id: retainedFuture.id,
            name: 'Sign venue contract',
            deadline: null,
            ownerId: null,
            blocked: false,
            checklistItems: [],
          },
          {
            name: 'Pay deposit',
            deadline: null,
            ownerId: null,
            blocked: false,
            checklistItems: [],
          },
        ],
      })
      .expect(200);

    const body = response.body as WorkstreamDto;
    expect(
      body.steps.map(({ name, position }) => ({ name, position })),
    ).toEqual([
      { name: past.name, position: 1 },
      { name: 'Tour shortlisted venues', position: 2 },
      { name: 'Sign venue contract', position: 3 },
      { name: 'Pay deposit', position: 4 },
    ]);
    expect(body.steps[0]).toMatchObject({
      id: past.id,
      status: 'done',
      outcome: StepOutcome.Done,
    });
    expect(body.steps[1]).toMatchObject({
      id: current.id,
      explicitOwnerId: owner.id,
      effectiveOwnerId: owner.id,
      blocked: true,
    });
    expect(body.steps[1]?.checklistItems).toMatchObject([
      { id: secondItem!.id, name: 'Second first', position: 1, done: false },
      { id: firstItem!.id, name: 'First second', position: 2, done: true },
    ]);
    expect(body.steps.some((step) => step.id === removedFuture.id)).toBe(false);
  });

  it('rejects removing or moving the current step', async () => {
    const project = em.create(Project, { name: 'Wedding Prep' });
    const workstream = em.create(Workstream, {
      project,
      name: 'Music',
      icon: '🎵',
      startedAt: new Date('2026-07-01T00:00:00.000Z'),
    });
    const current = em.create(Step, {
      workstream,
      position: 1,
      name: 'Shortlist DJs',
    });
    const future = em.create(Step, {
      workstream,
      position: 2,
      name: 'Book DJ',
    });
    await em.flush();
    workstream.currentStep = current;
    await em.flush();

    const response = await request(app.getHttpServer() as never)
      .put(`/workstreams/${workstream.id}/pipeline`)
      .set('Authorization', authorization)
      .send({
        expectedUpdatedAt: workstream.updatedAt.toISOString(),
        steps: [
          {
            id: future.id,
            name: future.name,
            deadline: null,
            ownerId: null,
            blocked: false,
            checklistItems: [],
          },
          {
            id: current.id,
            name: current.name,
            deadline: null,
            ownerId: null,
            blocked: false,
            checklistItems: [],
          },
        ],
      })
      .expect(409);

    expect(response.body).toMatchObject({
      type: 'https://api.example.com/errors/step-not-deletable',
    });
  });

  it('rejects submitted past steps and complete workstreams as frozen', async () => {
    const project = em.create(Project, { name: 'Wedding Prep' });
    const workstream = em.create(Workstream, {
      project,
      name: 'Invitations',
      icon: '✉️',
      startedAt: new Date('2026-07-01T00:00:00.000Z'),
    });
    const past = em.create(Step, {
      workstream,
      position: 1,
      name: 'Collect addresses',
      outcome: StepOutcome.Done,
      outcomeAt: new Date('2026-07-02T00:00:00.000Z'),
    });
    const current = em.create(Step, {
      workstream,
      position: 2,
      name: 'Send invitations',
    });
    await em.flush();
    workstream.currentStep = current;
    await em.flush();

    const frozenResponse = await request(app.getHttpServer() as never)
      .put(`/workstreams/${workstream.id}/pipeline`)
      .set('Authorization', authorization)
      .send({
        expectedUpdatedAt: workstream.updatedAt.toISOString(),
        steps: [
          {
            id: past.id,
            name: 'Rewrite history',
            deadline: null,
            ownerId: null,
            blocked: false,
            checklistItems: [],
          },
        ],
      })
      .expect(409);
    expect(frozenResponse.body).toMatchObject({
      type: 'https://api.example.com/errors/step-frozen',
    });

    workstream.currentStep = null;
    workstream.completedAt = new Date();
    current.outcome = StepOutcome.Done;
    current.outcomeAt = new Date();
    await em.flush();

    const completeResponse = await request(app.getHttpServer() as never)
      .put(`/workstreams/${workstream.id}/pipeline`)
      .set('Authorization', authorization)
      .send({
        expectedUpdatedAt: workstream.updatedAt.toISOString(),
        steps: [],
      })
      .expect(409);
    expect(completeResponse.body).toMatchObject({
      type: 'https://api.example.com/errors/step-frozen',
    });
  });

  it('rejects stale edits without changing the pipeline', async () => {
    const project = em.create(Project, { name: 'Wedding Prep' });
    const workstream = em.create(Workstream, {
      project,
      name: 'Flowers',
      icon: '💐',
    });
    const step = em.create(Step, {
      workstream,
      position: 1,
      name: 'Find florist',
    });
    await em.flush();
    const staleUpdatedAt = workstream.updatedAt.toISOString();
    workstream.name = 'Flowers and decor';
    await em.flush();

    const response = await request(app.getHttpServer() as never)
      .put(`/workstreams/${workstream.id}/pipeline`)
      .set('Authorization', authorization)
      .send({
        expectedUpdatedAt: staleUpdatedAt,
        steps: [
          {
            id: step.id,
            name: 'Should not persist',
            deadline: null,
            ownerId: null,
            blocked: false,
            checklistItems: [],
          },
        ],
      })
      .expect(409);
    expect(response.body).toMatchObject({
      type: 'https://api.example.com/errors/pipeline-stale',
    });

    em.clear();
    const unchanged = await em.findOneOrFail(Step, { id: step.id });
    expect(unchanged.name).toBe('Find florist');
  });

  it('rolls back all changes when a nested checklist id mismatches', async () => {
    const project = em.create(Project, { name: 'Wedding Prep' });
    const workstream = em.create(Workstream, {
      project,
      name: 'Cake',
      icon: '🎂',
    });
    const step = em.create(Step, {
      workstream,
      position: 1,
      name: 'Taste cakes',
      checklistItems: [{ position: 1, name: 'Vanilla', done: false }],
    });
    await em.flush();

    const response = await request(app.getHttpServer() as never)
      .put(`/workstreams/${workstream.id}/pipeline`)
      .set('Authorization', authorization)
      .send({
        expectedUpdatedAt: workstream.updatedAt.toISOString(),
        steps: [
          {
            id: step.id,
            name: 'Changed name',
            deadline: null,
            ownerId: null,
            blocked: true,
            checklistItems: [
              {
                id: '11111111-1111-4111-8111-111111111111',
                name: 'Foreign',
                done: true,
              },
            ],
          },
        ],
      })
      .expect(409);
    expect(response.body).toMatchObject({
      type: 'https://api.example.com/errors/pipeline-mismatch',
    });

    em.clear();
    const unchangedStep = await em.findOneOrFail(
      Step,
      { id: step.id },
      { populate: ['checklistItems'] },
    );
    expect(unchangedStep).toMatchObject({
      name: 'Taste cakes',
      blocked: false,
    });
    expect(unchangedStep.getChecklistItems()).toMatchObject([
      { name: 'Vanilla', done: false },
    ]);
  });

  it('validates required nested fields', async () => {
    await request(app.getHttpServer() as never)
      .put('/workstreams/11111111-1111-4111-8111-111111111111/pipeline')
      .set('Authorization', authorization)
      .send({
        expectedUpdatedAt: new Date().toISOString(),
        steps: [
          {
            name: 'Missing owner',
            deadline: null,
            blocked: false,
            checklistItems: [],
          },
        ],
      })
      .expect(422);
  });
});
