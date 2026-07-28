import request from 'supertest';

import { createTestApp } from '@/__e2e-tests__/helpers/create-app.helper';
import { MockTokenFactory } from '@/__e2e-tests__/helpers/mock-token.factory';
import {
  resetDatabase,
  testEntityManager,
} from '@/__e2e-tests__/helpers/reset-database.helper';
import { MockOidcService } from '@/__e2e-tests__/mocks/mock-oidc.service';
import { ChecklistItem } from '@/database/entities/checklist-item.entity';
import { Project } from '@/database/entities/project.entity';
import { Step, StepOutcome } from '@/database/entities/step.entity';
import { Workstream } from '@/database/entities/workstream.entity';

import type { ChecklistItemDto } from '@/modules/project/dtos/output/checklist-item.dto';
import type { SqlEntityManager } from '@mikro-orm/postgresql';
import type { INestApplication } from '@nestjs/common';

describe('Checklist item toggle E2E Tests', () => {
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

  it('immediately toggles a current checklist item and touches its workstream', async () => {
    const project = em.create(Project, { name: 'Wedding Prep' });
    const workstream = em.create(Workstream, {
      project,
      name: 'Venue',
      icon: '🏛️',
      startedAt: new Date('2026-07-01T00:00:00.000Z'),
    });
    const current = em.create(Step, {
      workstream,
      position: 1,
      name: 'Tour venues',
    });
    const item = em.create(ChecklistItem, {
      step: current,
      position: 1,
      name: 'Visit château',
      done: false,
    });
    await em.flush();
    workstream.currentStep = current;
    await em.flush();
    const originalUpdatedAt = workstream.updatedAt.toISOString();

    const response = await request(app.getHttpServer() as never)
      .patch(`/checklist-items/${item.id}`)
      .set('Authorization', authorization)
      .send({ done: true })
      .expect(200);

    expect(response.body as ChecklistItemDto).toMatchObject({
      id: item.id,
      name: item.name,
      done: true,
    });
    em.clear();
    const updatedWorkstream = await em.findOneOrFail(Workstream, {
      id: workstream.id,
    });
    expect(updatedWorkstream.updatedAt.toISOString()).not.toBe(
      originalUpdatedAt,
    );
  });

  it('allows future checklist items but rejects past ones as frozen', async () => {
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
      name: 'Draft invitations',
    });
    const future = em.create(Step, {
      workstream,
      position: 3,
      name: 'Post invitations',
    });
    const pastItem = em.create(ChecklistItem, {
      step: past,
      position: 1,
      name: 'Family addresses',
      done: true,
    });
    const futureItem = em.create(ChecklistItem, {
      step: future,
      position: 1,
      name: 'Buy stamps',
      done: false,
    });
    await em.flush();
    workstream.currentStep = current;
    await em.flush();

    await request(app.getHttpServer() as never)
      .patch(`/checklist-items/${futureItem.id}`)
      .set('Authorization', authorization)
      .send({ done: true })
      .expect(200);

    const frozenResponse = await request(app.getHttpServer() as never)
      .patch(`/checklist-items/${pastItem.id}`)
      .set('Authorization', authorization)
      .send({ done: false })
      .expect(409);
    expect(frozenResponse.body).toMatchObject({
      type: 'https://api.example.com/errors/step-frozen',
    });

    em.clear();
    const unchangedPast = await em.findOneOrFail(ChecklistItem, {
      id: pastItem.id,
    });
    expect(unchangedPast.done).toBe(true);
  });

  it('validates the toggle and requires an existing authenticated item', async () => {
    const itemUrl = '/checklist-items/11111111-1111-4111-8111-111111111111';

    await request(app.getHttpServer() as never)
      .patch(itemUrl)
      .set('Authorization', authorization)
      .send({ done: null })
      .expect(422);
    await request(app.getHttpServer() as never)
      .patch(itemUrl)
      .set('Authorization', authorization)
      .send({ done: true })
      .expect(404);
    await request(app.getHttpServer() as never)
      .patch(itemUrl)
      .send({ done: true })
      .expect(401);
  });
});
