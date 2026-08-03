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
import { Workstream } from '@/database/entities/workstream.entity';

import type { OverviewDto } from '@/modules/project/dtos/output/overview.dto';
import type { WorkstreamDto } from '@/modules/project/dtos/output/workstream.dto';
import type { SqlEntityManager } from '@mikro-orm/postgresql';
import type { INestApplication } from '@nestjs/common';

describe('Workstream advance E2E Tests', () => {
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

  it('starts a populated workstream at its first step', async () => {
    const project = em.create(Project, { name: 'Wedding Prep' });
    const workstream = em.create(Workstream, {
      project,
      position: 0,
      name: 'Catering',
      icon: '🍽️',
    });
    const firstStep = em.create(Step, {
      workstream,
      position: 1,
      name: 'Request quotes',
      notes: [{ content: 'Three caterers contacted.' }],
    });
    em.create(Step, {
      workstream,
      position: 2,
      name: 'Book caterer',
    });
    await em.flush();

    const response = await request(app.getHttpServer() as never)
      .post(`/workstreams/${workstream.id}/advance`)
      .set('Authorization', authorization)
      .send({})
      .expect(200);

    const body = response.body as WorkstreamDto;
    expect(body).toMatchObject({
      id: workstream.id,
      lifecycle: 'active',
      currentStepId: firstStep.id,
    });
    expect(body.startedAt).toEqual(expect.any(String));
    expect(body.completedAt).toBeNull();
    expect(body.steps.map((step) => step.status)).toEqual([
      'in_progress',
      'not_started',
    ]);
    expect(body.steps[0]?.outcome).toBeNull();
    expect(body.steps.map((step) => step.noteCount)).toEqual([1, 0]);
  });

  it('rejects an outcome when starting a workstream', async () => {
    const project = em.create(Project, { name: 'Wedding Prep' });
    const workstream = em.create(Workstream, {
      project,
      position: 0,
      name: 'Flowers',
      icon: '💐',
    });
    em.create(Step, {
      workstream,
      position: 1,
      name: 'Find a florist',
    });
    await em.flush();

    await request(app.getHttpServer() as never)
      .post(`/workstreams/${workstream.id}/advance`)
      .set('Authorization', authorization)
      .send({ outcome: StepOutcome.Done })
      .expect(400);
  });

  it('rejects starting an empty workstream with a typed conflict', async () => {
    const project = em.create(Project, { name: 'Wedding Prep' });
    const workstream = em.create(Workstream, {
      project,
      position: 0,
      name: 'Empty pipeline',
      icon: '📭',
    });
    await em.flush();

    const response = await request(app.getHttpServer() as never)
      .post(`/workstreams/${workstream.id}/advance`)
      .set('Authorization', authorization)
      .send({})
      .expect(409);

    expect(response.body).toMatchObject({
      type: 'https://api.example.com/errors/workstream-empty',
      detail: 'Add at least one step before starting this workstream',
    });
  });

  it('records Done and moves an active workstream to its next step', async () => {
    const project = em.create(Project, { name: 'Wedding Prep' });
    const workstream = em.create(Workstream, {
      project,
      position: 0,
      name: 'Catering',
      icon: '🍽️',
      startedAt: new Date('2026-07-01T00:00:00.000Z'),
    });
    const currentStep = em.create(Step, {
      workstream,
      position: 1,
      name: 'Request quotes',
    });
    const nextStep = em.create(Step, {
      workstream,
      position: 2,
      name: 'Book caterer',
    });
    await em.flush();
    workstream.currentStep = currentStep;
    await em.flush();

    const response = await request(app.getHttpServer() as never)
      .post(`/workstreams/${workstream.id}/advance`)
      .set('Authorization', authorization)
      .send({})
      .expect(200);

    const body = response.body as WorkstreamDto;
    expect(body).toMatchObject({
      lifecycle: 'active',
      currentStepId: nextStep.id,
    });
    expect(body.steps[0]).toMatchObject({
      status: 'done',
      outcome: StepOutcome.Done,
    });
    expect(body.steps[0]?.outcomeAt).toEqual(expect.any(String));
    expect(body.steps[1]).toMatchObject({
      status: 'in_progress',
      outcome: null,
    });
  });

  it('records Skipped when that outcome is chosen', async () => {
    const project = em.create(Project, { name: 'Wedding Prep' });
    const workstream = em.create(Workstream, {
      project,
      position: 0,
      name: 'Invitations',
      icon: '✉️',
      startedAt: new Date('2026-07-01T00:00:00.000Z'),
    });
    const currentStep = em.create(Step, {
      workstream,
      position: 1,
      name: 'Collect addresses',
      blocked: true,
      checklistItems: [
        { position: 1, name: 'Partner family', done: true },
        { position: 2, name: 'Extended family', done: false },
      ],
    });
    em.create(Step, {
      workstream,
      position: 2,
      name: 'Send invitations',
    });
    await em.flush();
    workstream.currentStep = currentStep;
    await em.flush();

    const response = await request(app.getHttpServer() as never)
      .post(`/workstreams/${workstream.id}/advance`)
      .set('Authorization', authorization)
      .send({ outcome: StepOutcome.Skipped })
      .expect(200);

    const body = response.body as WorkstreamDto;
    expect(body.steps[0]).toMatchObject({
      status: 'skipped',
      outcome: StepOutcome.Skipped,
      blocked: true,
    });
    expect(body.steps[0]?.checklistItems.map((item) => item.done)).toEqual([
      true,
      false,
    ]);
    expect(body.steps[1]?.status).toBe('in_progress');
  });

  it('completes the workstream when its last step is advanced', async () => {
    const project = em.create(Project, { name: 'Wedding Prep' });
    const workstream = em.create(Workstream, {
      project,
      position: 0,
      name: 'Venue',
      icon: '🏛️',
      startedAt: new Date('2026-07-01T00:00:00.000Z'),
    });
    const lastStep = em.create(Step, {
      workstream,
      position: 1,
      name: 'Sign contract',
    });
    await em.flush();
    workstream.currentStep = lastStep;
    await em.flush();

    const response = await request(app.getHttpServer() as never)
      .post(`/workstreams/${workstream.id}/advance`)
      .set('Authorization', authorization)
      .send({})
      .expect(200);

    const body = response.body as WorkstreamDto;
    expect(body).toMatchObject({
      lifecycle: 'complete',
      currentStepId: null,
    });
    expect(body.completedAt).toEqual(expect.any(String));
    expect(body.steps[0]).toMatchObject({
      status: 'done',
      outcome: StepOutcome.Done,
    });
  });

  it('rejects advancing a complete workstream with a typed conflict', async () => {
    const project = em.create(Project, { name: 'Wedding Prep' });
    const workstream = em.create(Workstream, {
      project,
      position: 0,
      name: 'Venue',
      icon: '🏛️',
      startedAt: new Date('2026-07-01T00:00:00.000Z'),
      completedAt: new Date('2026-07-10T00:00:00.000Z'),
    });
    em.create(Step, {
      workstream,
      position: 1,
      name: 'Sign contract',
      outcome: StepOutcome.Done,
      outcomeAt: new Date('2026-07-10T00:00:00.000Z'),
    });
    await em.flush();

    const response = await request(app.getHttpServer() as never)
      .post(`/workstreams/${workstream.id}/advance`)
      .set('Authorization', authorization)
      .send({})
      .expect(409);

    expect(response.body).toMatchObject({
      type: 'https://api.example.com/errors/workstream-not-advanceable',
      detail: 'This workstream is already complete',
    });
  });

  it('serializes concurrent advances without losing a transition', async () => {
    const project = em.create(Project, { name: 'Wedding Prep' });
    const workstream = em.create(Workstream, {
      project,
      position: 0,
      name: 'Music',
      icon: '🎵',
      startedAt: new Date('2026-07-01T00:00:00.000Z'),
    });
    const firstStep = em.create(Step, {
      workstream,
      position: 1,
      name: 'Shortlist DJs',
    });
    em.create(Step, {
      workstream,
      position: 2,
      name: 'Compare quotes',
    });
    em.create(Step, {
      workstream,
      position: 3,
      name: 'Book DJ',
    });
    await em.flush();
    workstream.currentStep = firstStep;
    await em.flush();

    const advance = () =>
      request(app.getHttpServer() as never)
        .post(`/workstreams/${workstream.id}/advance`)
        .set('Authorization', authorization)
        .send({});

    const responses = await Promise.all([advance(), advance()]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);

    const overviewResponse = await request(app.getHttpServer() as never)
      .get(`/projects/${project.id}/overview`)
      .set('Authorization', authorization)
      .expect(200);

    const overview = overviewResponse.body as OverviewDto;
    const updated = overview.workstreams.find(
      (item) => item.id === workstream.id,
    );
    expect(updated?.steps.map((step) => step.status)).toEqual([
      'done',
      'done',
      'in_progress',
    ]);
  });

  it('rejects an invalid outcome', async () => {
    await request(app.getHttpServer() as never)
      .post('/workstreams/11111111-1111-4111-8111-111111111111/advance')
      .set('Authorization', authorization)
      .send({ outcome: 'abandoned' })
      .expect(422);
  });

  it('returns 404 for an unknown workstream', async () => {
    await request(app.getHttpServer() as never)
      .post('/workstreams/11111111-1111-4111-8111-111111111111/advance')
      .set('Authorization', authorization)
      .send({})
      .expect(404);
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer() as never)
      .post('/workstreams/11111111-1111-4111-8111-111111111111/advance')
      .send({})
      .expect(401);
  });
});
