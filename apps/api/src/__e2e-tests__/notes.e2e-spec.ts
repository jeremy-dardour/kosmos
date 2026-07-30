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
  let step3Id: string;
  let otherAuthorNoteId: string;
  let authorlessNoteId: string;

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
    const step3 = em.create(Step, {
      workstream,
      position: 3,
      name: 'Sign contract',
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
    const authorlessNote = em.create(Note, {
      step: step1,
      author: null,
      content: 'Note with no author',
      createdAt: instantAt(-8),
    });
    const otherAuthorNote = em.create(Note, {
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
    step3Id = step3.id;
    otherAuthorNoteId = otherAuthorNote.id;
    authorlessNoteId = authorlessNote.id;
  }

  function fetchNotes(id: string): request.Test {
    return createRequest(app)
      .get(`/workstreams/${id}/notes`)
      .set('Authorization', `Bearer ${token}`);
  }

  function createNote(
    stepId: string,
    body: Record<string, unknown>,
  ): request.Test {
    return createRequest(app)
      .post(`/steps/${stepId}/notes`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  function updateNote(
    noteId: string,
    body: Record<string, unknown>,
  ): request.Test {
    return createRequest(app)
      .patch(`/notes/${noteId}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  function deleteNote(noteId: string): request.Test {
    return createRequest(app)
      .delete(`/notes/${noteId}`)
      .set('Authorization', `Bearer ${token}`);
  }

  async function workstreamUpdatedAt(): Promise<number> {
    const workstream = await em.findOneOrFail(
      Workstream,
      { id: workstreamId },
      { refresh: true },
    );

    return workstream.updatedAt.getTime();
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

  describe('POST /steps/:stepId/notes', () => {
    it('adds notes to past, current and future steps without touching the workstream', async () => {
      const before = await workstreamUpdatedAt();

      for (const [stepId, content] of [
        [step1Id, 'Past step update'],
        [step2Id, 'Current step update'],
        [step3Id, 'Future step update'],
      ] as const) {
        const response = await createNote(stepId, { content }).expect(201);
        const note = response.body as NoteDto;

        expect(note).toMatchObject({
          stepId,
          content,
          author: {
            name: 'E2E Test User',
          },
        });
      }

      expect(await workstreamUpdatedAt()).toBe(before);
    });

    it.each([
      ['', 'empty'],
      ['   \n', 'whitespace-only'],
      ['x'.repeat(5001), 'overlong'],
    ])('rejects %s content with 422', async (content) => {
      await createNote(step2Id, { content }).expect(422);
    });

    it('rejects client-supplied authors', async () => {
      await createNote(step2Id, {
        content: 'Spoofed',
        authorId: '00000000-0000-0000-0000-000000000000',
      }).expect(422);
    });

    it('returns 404 for an unknown step and 400 for a malformed ID', async () => {
      await createNote('00000000-0000-0000-0000-000000000000', {
        content: 'Missing',
      }).expect(404);
      await createNote('not-a-uuid', { content: 'Malformed' }).expect(400);
    });
  });

  describe('PATCH /notes/:id', () => {
    it('edits an own note, advances its timestamp and leaves the workstream unchanged', async () => {
      const createdResponse = await createNote(step2Id, {
        content: 'Initial content',
      }).expect(201);
      const created = createdResponse.body as NoteDto;
      const before = await workstreamUpdatedAt();

      const response = await updateNote(created.id, {
        content: 'Edited content',
      }).expect(200);
      const edited = response.body as NoteDto;

      expect(edited.content).toBe('Edited content');
      expect(new Date(edited.updatedAt).getTime()).toBeGreaterThan(
        new Date(created.updatedAt).getTime(),
      );
      expect(await workstreamUpdatedAt()).toBe(before);
    });

    it.each([
      ['another user', () => otherAuthorNoteId],
      ['no author', () => authorlessNoteId],
    ])('rejects editing a note with %s', async (_label, getId) => {
      const response = await updateNote(getId(), {
        content: 'Forbidden edit',
      }).expect(403);

      expect((response.body as { type: string }).type).toMatch(
        /\/errors\/not-note-author$/,
      );
    });

    it('returns 404 for an unknown note and 400 for a malformed ID', async () => {
      await updateNote('00000000-0000-0000-0000-000000000000', {
        content: 'Missing',
      }).expect(404);
      await updateNote('not-a-uuid', { content: 'Malformed' }).expect(400);
    });
  });

  describe('DELETE /notes/:id', () => {
    it('hard-deletes an own note without touching the workstream', async () => {
      const createdResponse = await createNote(step2Id, {
        content: 'Remove me',
      }).expect(201);
      const created = createdResponse.body as NoteDto;
      const before = await workstreamUpdatedAt();

      await deleteNote(created.id).expect(204);

      expect(
        await em.findOne(Note, { id: created.id }, { refresh: true }),
      ).toBe(null);
      expect(await workstreamUpdatedAt()).toBe(before);
    });

    it.each([
      ['another user', () => otherAuthorNoteId],
      ['no author', () => authorlessNoteId],
    ])('rejects deleting a note with %s', async (_label, getId) => {
      const response = await deleteNote(getId()).expect(403);

      expect((response.body as { type: string }).type).toMatch(
        /\/errors\/not-note-author$/,
      );
    });
  });
});
