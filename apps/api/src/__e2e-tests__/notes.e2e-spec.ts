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
import { instantAt } from '@/shared/utils/calendar-day';

import type { NoteDto } from '@/modules/project/dtos/output/note.dto';
import type { SqlEntityManager } from '@mikro-orm/postgresql';
import type { INestApplication } from '@nestjs/common';
import type { Test as SuperTestType } from 'supertest';
import type TestAgent from 'supertest/lib/agent';

function createRequest(app: INestApplication): TestAgent<SuperTestType> {
  return request(app.getHttpServer() as never);
}

describe('Notes E2E Tests', () => {
  const mockOidc = new MockOidcService();
  let tokenFactory: MockTokenFactory;
  let app: INestApplication;
  let em: SqlEntityManager;
  let token: string;

  let workstreamId: string;
  let emptyWorkstreamId: string;
  let step1Id: string;
  let step2Id: string;

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

  async function seedFixture(): Promise<void> {
    const author1 = em.create(User, {
      email: 'author1@example.com',
      name: 'Author One',
      avatarUrl: 'https://example.com/a1.png',
    });
    const author2 = em.create(User, {
      email: 'author2@example.com',
      name: 'Author Two',
      avatarUrl: null,
    });

    const project = em.create(Project, { name: 'Wedding Prep' });

    const workstream = em.create(Workstream, {
      project,
      name: 'Venue',
      icon: '🏛️',
      startedAt: instantAt(-30),
    });
    const step1 = em.create(Step, {
      workstream,
      position: 1,
      name: 'Research',
      outcome: StepOutcome.Done,
      outcomeAt: instantAt(-20),
    });
    const step2 = em.create(Step, {
      workstream,
      position: 2,
      name: 'Visit venues',
    });

    const emptyWorkstream = em.create(Workstream, {
      project,
      name: 'Flowers',
      icon: '💐',
    });
    em.create(Step, {
      workstream: emptyWorkstream,
      position: 1,
      name: 'Pick florist',
    });

    em.create(Note, {
      step: step1,
      author: author1,
      content: 'Oldest note on step 1',
      createdAt: instantAt(-10),
    });
    em.create(Note, {
      step: step1,
      author: null,
      content: 'Note with no author',
      createdAt: instantAt(-8),
    });
    em.create(Note, {
      step: step2,
      author: author2,
      content: 'Note on step 2',
      createdAt: instantAt(-5),
    });
    em.create(Note, {
      step: step1,
      author: author1,
      content: 'Newest note on step 1',
      createdAt: instantAt(-3),
    });

    await em.flush();

    workstream.currentStep = step2;
    await em.flush();

    workstreamId = workstream.id;
    emptyWorkstreamId = emptyWorkstream.id;
    step1Id = step1.id;
    step2Id = step2.id;
  }

  function fetchNotes(id: string): request.Test {
    return createRequest(app)
      .get(`/workstreams/${id}/notes`)
      .set('Authorization', `Bearer ${token}`);
  }

  describe('GET /workstreams/:workstreamId/notes', () => {
    it('returns notes across all steps, newest first', async () => {
      const response = await fetchNotes(workstreamId).expect(200);
      const notes = response.body as NoteDto[];

      expect(notes).toHaveLength(4);
      expect(notes[0]!.content).toBe('Newest note on step 1');
      expect(notes[1]!.content).toBe('Note on step 2');
      expect(notes[2]!.content).toBe('Note with no author');
      expect(notes[3]!.content).toBe('Oldest note on step 1');
    });

    it('includes stepId on each note', async () => {
      const response = await fetchNotes(workstreamId).expect(200);
      const notes = response.body as NoteDto[];

      expect(notes[0]!.stepId).toBe(step1Id);
      expect(notes[1]!.stepId).toBe(step2Id);
    });

    it('includes author as UserSummaryDto or null', async () => {
      const response = await fetchNotes(workstreamId).expect(200);
      const notes = response.body as NoteDto[];

      expect(notes[0]!.author).toMatchObject({
        name: 'Author One',
        avatarUrl: 'https://example.com/a1.png',
      });
      expect(notes[1]!.author).toMatchObject({
        name: 'Author Two',
        avatarUrl: null,
      });
      expect(notes[2]!.author).toBeNull();
    });

    it('returns an empty array for a workstream with no notes', async () => {
      const response = await fetchNotes(emptyWorkstreamId).expect(200);

      expect(response.body).toEqual([]);
    });

    it('returns 404 for an unknown workstream', async () => {
      await fetchNotes('00000000-0000-0000-0000-000000000000').expect(404);
    });

    it('returns 400 for a malformed UUID', async () => {
      await fetchNotes('not-a-uuid').expect(400);
    });

    it('returns 401 without a token', async () => {
      await createRequest(app)
        .get(`/workstreams/${workstreamId}/notes`)
        .expect(401);
    });
  });
});
