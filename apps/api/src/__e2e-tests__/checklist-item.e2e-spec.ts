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

const errorType = (slug: string): string =>
  `https://api.example.com/errors/${slug}`;

const UNKNOWN_ITEM_URL =
  '/checklist-items/11111111-1111-4111-8111-111111111111';

describe('Checklist item E2E Tests', () => {
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
    await em.flush();
    workstream.currentStep = current;
    await em.flush();

    return { workstream, past, current, future };
  }

  function addItem(step: Step, name: string, position: number): ChecklistItem {
    return em.create(ChecklistItem, { step, position, name, done: false });
  }

  async function persistedItems(
    step: Step,
  ): Promise<{ name: string; position: number }[]> {
    em.clear();
    const items = await em.find(
      ChecklistItem,
      { step: step.id },
      { orderBy: { position: 'asc' } },
    );

    return items.map(({ name, position }) => ({ name, position }));
  }

  describe('POST /steps/:stepId/checklist-items', () => {
    it('appends an undone item to the current step and touches its workstream', async () => {
      const { workstream, current } = await createStartedWorkstream();
      addItem(current, 'Draft wording', 1);
      await em.flush();
      const originalUpdatedAt = workstream.updatedAt.toISOString();

      const response = await request(app.getHttpServer() as never)
        .post(`/steps/${current.id}/checklist-items`)
        .set('Authorization', authorization)
        .send({ name: 'Proofread' })
        .expect(201);

      expect(response.body as ChecklistItemDto).toMatchObject({
        name: 'Proofread',
        position: 2,
        done: false,
      });
      expect(await persistedItems(current)).toEqual([
        { name: 'Draft wording', position: 1 },
        { name: 'Proofread', position: 2 },
      ]);

      const updatedWorkstream = await em.findOneOrFail(Workstream, {
        id: workstream.id,
      });
      expect(updatedWorkstream.updatedAt.toISOString()).not.toBe(
        originalUpdatedAt,
      );
    });

    it('appends past the highest position rather than counting the items', async () => {
      const { future } = await createStartedWorkstream();
      addItem(future, 'Buy stamps', 1);
      addItem(future, 'Print labels', 5);
      await em.flush();

      const response = await request(app.getHttpServer() as never)
        .post(`/steps/${future.id}/checklist-items`)
        .set('Authorization', authorization)
        .send({ name: 'Seal envelopes' })
        .expect(201);

      expect((response.body as ChecklistItemDto).position).toBe(6);
    });

    it('appends after a delete has renumbered the survivors', async () => {
      const { future } = await createStartedWorkstream();
      addItem(future, 'First', 1);
      const second = addItem(future, 'Second', 2);
      addItem(future, 'Third', 3);
      await em.flush();

      await request(app.getHttpServer() as never)
        .delete(`/checklist-items/${second.id}`)
        .set('Authorization', authorization)
        .expect(204);

      const response = await request(app.getHttpServer() as never)
        .post(`/steps/${future.id}/checklist-items`)
        .set('Authorization', authorization)
        .send({ name: 'Fourth' })
        .expect(201);

      expect((response.body as ChecklistItemDto).position).toBe(3);
      expect(await persistedItems(future)).toEqual([
        { name: 'First', position: 1 },
        { name: 'Third', position: 2 },
        { name: 'Fourth', position: 3 },
      ]);
    });

    it('rejects adding to a past step', async () => {
      const { past } = await createStartedWorkstream();

      const response = await request(app.getHttpServer() as never)
        .post(`/steps/${past.id}/checklist-items`)
        .set('Authorization', authorization)
        .send({ name: 'Too late' })
        .expect(409);

      expect(response.body).toMatchObject({ type: errorType('step-frozen') });
      expect(await persistedItems(past)).toEqual([]);
    });

    it('rejects an empty name, an unknown step and an anonymous caller', async () => {
      const { current } = await createStartedWorkstream();

      await request(app.getHttpServer() as never)
        .post(`/steps/${current.id}/checklist-items`)
        .set('Authorization', authorization)
        .send({ name: '' })
        .expect(422);

      await request(app.getHttpServer() as never)
        .post('/steps/11111111-1111-4111-8111-111111111111/checklist-items')
        .set('Authorization', authorization)
        .send({ name: 'Orphan' })
        .expect(404);

      await request(app.getHttpServer() as never)
        .post(`/steps/${current.id}/checklist-items`)
        .send({ name: 'Anonymous' })
        .expect(401);
    });
  });

  describe('PATCH /checklist-items/:id', () => {
    it('renames and toggles a current item, and touches its workstream', async () => {
      const { workstream, current } = await createStartedWorkstream();
      const item = addItem(current, 'Visit chateau', 1);
      await em.flush();
      const originalUpdatedAt = workstream.updatedAt.toISOString();

      const response = await request(app.getHttpServer() as never)
        .patch(`/checklist-items/${item.id}`)
        .set('Authorization', authorization)
        .send({ name: 'Visit the chateau', done: true })
        .expect(200);

      expect(response.body as ChecklistItemDto).toMatchObject({
        id: item.id,
        name: 'Visit the chateau',
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

    it('leaves the fields that were not submitted alone', async () => {
      const { current } = await createStartedWorkstream();
      const item = addItem(current, 'Choose paper', 1);
      await em.flush();

      await request(app.getHttpServer() as never)
        .patch(`/checklist-items/${item.id}`)
        .set('Authorization', authorization)
        .send({ done: true })
        .expect(200);

      const response = await request(app.getHttpServer() as never)
        .patch(`/checklist-items/${item.id}`)
        .set('Authorization', authorization)
        .send({ name: 'Choose the paper' })
        .expect(200);

      expect(response.body as ChecklistItemDto).toMatchObject({
        name: 'Choose the paper',
        done: true,
      });
    });

    it('allows future checklist items but rejects past ones as frozen', async () => {
      const { past, future } = await createStartedWorkstream();
      const pastItem = addItem(past, 'Family addresses', 1);
      pastItem.done = true;
      const futureItem = addItem(future, 'Buy stamps', 1);
      await em.flush();

      await request(app.getHttpServer() as never)
        .patch(`/checklist-items/${futureItem.id}`)
        .set('Authorization', authorization)
        .send({ done: true })
        .expect(200);

      const frozenResponse = await request(app.getHttpServer() as never)
        .patch(`/checklist-items/${pastItem.id}`)
        .set('Authorization', authorization)
        .send({ done: false, name: 'Rewrite history' })
        .expect(409);
      expect(frozenResponse.body).toMatchObject({
        type: errorType('step-frozen'),
      });

      em.clear();
      const unchangedPast = await em.findOneOrFail(ChecklistItem, {
        id: pastItem.id,
      });
      expect(unchangedPast).toMatchObject({
        done: true,
        name: 'Family addresses',
      });
    });

    it('validates the payload and requires an existing authenticated item', async () => {
      const { current } = await createStartedWorkstream();
      const item = addItem(current, 'Pick a font', 1);
      await em.flush();

      for (const payload of [{ done: null }, { name: null }, { name: '' }]) {
        await request(app.getHttpServer() as never)
          .patch(`/checklist-items/${item.id}`)
          .set('Authorization', authorization)
          .send(payload)
          .expect(422);
      }

      await request(app.getHttpServer() as never)
        .patch(UNKNOWN_ITEM_URL)
        .set('Authorization', authorization)
        .send({ done: true })
        .expect(404);
      await request(app.getHttpServer() as never)
        .patch(UNKNOWN_ITEM_URL)
        .send({ done: true })
        .expect(401);
    });
  });

  describe('DELETE /checklist-items/:id', () => {
    it('deletes the item, renumbers the rest and touches its workstream', async () => {
      const { workstream, current } = await createStartedWorkstream();
      addItem(current, 'First', 1);
      const second = addItem(current, 'Second', 2);
      addItem(current, 'Third', 3);
      await em.flush();
      const originalUpdatedAt = workstream.updatedAt.toISOString();

      await request(app.getHttpServer() as never)
        .delete(`/checklist-items/${second.id}`)
        .set('Authorization', authorization)
        .expect(204);

      expect(await persistedItems(current)).toEqual([
        { name: 'First', position: 1 },
        { name: 'Third', position: 2 },
      ]);

      const updatedWorkstream = await em.findOneOrFail(Workstream, {
        id: workstream.id,
      });
      expect(updatedWorkstream.updatedAt.toISOString()).not.toBe(
        originalUpdatedAt,
      );
    });

    it('rejects deleting an item on a past step', async () => {
      const { past } = await createStartedWorkstream();
      const pastItem = addItem(past, 'Family addresses', 1);
      await em.flush();

      const response = await request(app.getHttpServer() as never)
        .delete(`/checklist-items/${pastItem.id}`)
        .set('Authorization', authorization)
        .expect(409);

      expect(response.body).toMatchObject({ type: errorType('step-frozen') });
      expect(await persistedItems(past)).toEqual([
        { name: 'Family addresses', position: 1 },
      ]);
    });

    it('requires an existing authenticated item', async () => {
      await request(app.getHttpServer() as never)
        .delete(UNKNOWN_ITEM_URL)
        .set('Authorization', authorization)
        .expect(404);
      await request(app.getHttpServer() as never)
        .delete(UNKNOWN_ITEM_URL)
        .expect(401);
    });
  });
});
