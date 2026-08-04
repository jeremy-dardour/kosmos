import request from 'supertest';

import { createTestApp } from '@/__e2e-tests__/helpers/create-app.helper';
import { MockTokenFactory } from '@/__e2e-tests__/helpers/mock-token.factory';
import {
  resetDatabase,
  testEntityManager,
} from '@/__e2e-tests__/helpers/reset-database.helper';
import { signIn } from '@/__e2e-tests__/helpers/sign-in.helper';
import { MockOidcService } from '@/__e2e-tests__/mocks/mock-oidc.service';
import { Group } from '@/database/entities/group.entity';
import { Project } from '@/database/entities/project.entity';
import { Workstream } from '@/database/entities/workstream.entity';

import type { GroupDto } from '@/modules/project/dtos/output/group.dto';
import type { OverviewDto } from '@/modules/project/dtos/output/overview.dto';
import type { ProjectDto } from '@/modules/project/dtos/output/project.dto';
import type { WorkstreamDto } from '@/modules/project/dtos/output/workstream.dto';
import type { SqlEntityManager } from '@mikro-orm/postgresql';
import type { INestApplication } from '@nestjs/common';

describe('Manual ordering E2E Tests', () => {
  const mockOidc = new MockOidcService();
  let tokenFactory: MockTokenFactory;
  let app: INestApplication;
  let em: SqlEntityManager;
  let authorization: string;
  let projectId: string;

  beforeAll(async () => {
    await mockOidc.setup();
    tokenFactory = new MockTokenFactory(mockOidc, process.env.AUTH_CLIENT_ID!);
  });

  beforeEach(async () => {
    app = await createTestApp({ oidcOverride: mockOidc });
    em = testEntityManager(app);
    authorization = `Bearer ${await tokenFactory.validToken()}`;
    await resetDatabase(em);
    await signIn(app, authorization);

    projectId = await createProject('Wedding Prep');
  });

  afterEach(async () => {
    await app.close();
  });

  async function createProject(name = 'Other Wedding'): Promise<string> {
    const response = await request(app.getHttpServer() as never)
      .post('/projects')
      .set('Authorization', authorization)
      .send({ name })
      .expect(201);

    return (response.body as ProjectDto).id;
  }

  async function createGroup(
    name: string,
    scopeProjectId = projectId,
  ): Promise<GroupDto> {
    const response = await request(app.getHttpServer() as never)
      .post(`/projects/${scopeProjectId}/groups`)
      .set('Authorization', authorization)
      .send({ name, color: '#5a9e6f' })
      .expect(201);

    return response.body as GroupDto;
  }

  async function createWorkstream(
    name: string,
    groupId: string | null = null,
    scopeProjectId = projectId,
  ): Promise<WorkstreamDto> {
    const response = await request(app.getHttpServer() as never)
      .post(`/projects/${scopeProjectId}/workstreams`)
      .set('Authorization', authorization)
      .send({ name, icon: '🍽️', groupId })
      .expect(201);

    return response.body as WorkstreamDto;
  }

  async function moveToGroup(
    workstreamId: string,
    groupId: string | null,
  ): Promise<WorkstreamDto> {
    const response = await request(app.getHttpServer() as never)
      .patch(`/workstreams/${workstreamId}`)
      .set('Authorization', authorization)
      .send({ groupId })
      .expect(200);

    return response.body as WorkstreamDto;
  }

  /**
   * Complete workstreams are excluded from a reorder payload but keep their
   * slot in the scope's position sequence, so tests seed them directly.
   */
  async function createCompleteWorkstream(
    name: string,
    groupId: string | null,
    position: number,
  ): Promise<string> {
    const workstream = em.create(Workstream, {
      project: em.getReference(Project, projectId),
      group: groupId ? em.getReference(Group, groupId) : null,
      position,
      name,
      icon: '📦',
      startedAt: new Date('2026-07-01T00:00:00.000Z'),
      completedAt: new Date('2026-07-02T00:00:00.000Z'),
    });
    await em.flush();

    return workstream.id;
  }

  function reorderGroups(
    ids: string[],
    scopeProjectId = projectId,
  ): request.Test {
    return request(app.getHttpServer() as never)
      .put(`/projects/${scopeProjectId}/group-order`)
      .set('Authorization', authorization)
      .send({ ids });
  }

  function reorderWorkstreams(
    groupId: string | null,
    ids: string[],
    scopeProjectId = projectId,
  ): request.Test {
    return request(app.getHttpServer() as never)
      .put(`/projects/${scopeProjectId}/workstream-order`)
      .set('Authorization', authorization)
      .send({ groupId, ids });
  }

  async function fetchOverview(): Promise<OverviewDto> {
    const response = await request(app.getHttpServer() as never)
      .get(`/projects/${projectId}/overview`)
      .set('Authorization', authorization)
      .expect(200);

    return response.body as OverviewDto;
  }

  async function scopeOrder(
    groupId: string | null,
  ): Promise<[string, number][]> {
    const overview = await fetchOverview();

    return overview.workstreams
      .filter((workstream) => (workstream.groupId ?? null) === groupId)
      .map((workstream) => [workstream.name, workstream.position]);
  }

  it('inserts each new workstream at the top of the ungrouped scope', async () => {
    await createWorkstream('Venue');
    await createWorkstream('Catering');
    const last = await createWorkstream('Flowers');

    expect(last.position).toBe(0);
    expect(await scopeOrder(null)).toEqual([
      ['Flowers', 0],
      ['Catering', 1],
      ['Venue', 2],
    ]);
  });

  it('shifts only the siblings of the scope it is inserted into', async () => {
    const group = await createGroup('Vendors');
    await createWorkstream('Venue');
    await createWorkstream('Music', group.id);
    await createWorkstream('Flowers', group.id);

    expect(await scopeOrder(null)).toEqual([['Venue', 0]]);
    expect(await scopeOrder(group.id)).toEqual([
      ['Flowers', 0],
      ['Music', 1],
    ]);
  });

  it('appends each new group after the existing ones', async () => {
    await createGroup('Vendors');
    await createGroup('Logistics');
    await createGroup('Attire');

    const overview = await fetchOverview();
    expect(
      overview.groups.map((group) => [group.name, group.position]),
    ).toEqual([
      ['Vendors', 0],
      ['Logistics', 1],
      ['Attire', 2],
    ]);
  });

  it('appends past the hole a deleted group leaves in the order', async () => {
    await createGroup('Vendors');
    const middle = await createGroup('Logistics');
    await createGroup('Attire');

    await request(app.getHttpServer() as never)
      .delete(`/groups/${middle.id}`)
      .set('Authorization', authorization)
      .expect(204);

    const appended = await createGroup('Music');

    expect(appended.position).toBe(3);
    const overview = await fetchOverview();
    expect(
      overview.groups.map((group) => [group.name, group.position]),
    ).toEqual([
      ['Vendors', 0],
      ['Attire', 2],
      ['Music', 3],
    ]);
  });

  it('moves a workstream to the top of its new group and closes the gap left behind', async () => {
    const source = await createGroup('Vendors');
    const target = await createGroup('Logistics');
    await createWorkstream('Venue', source.id);
    const moved = await createWorkstream('Music', source.id);
    await createWorkstream('Flowers', source.id);
    await createWorkstream('Invitations', target.id);

    const response = await moveToGroup(moved.id, target.id);

    expect(response).toMatchObject({ groupId: target.id, position: 0 });
    expect(await scopeOrder(source.id)).toEqual([
      ['Flowers', 0],
      ['Venue', 1],
    ]);
    expect(await scopeOrder(target.id)).toEqual([
      ['Music', 0],
      ['Invitations', 1],
    ]);
  });

  it('moves a workstream to the top of the ungrouped scope', async () => {
    const group = await createGroup('Vendors');
    await createWorkstream('Venue');
    await createWorkstream('Music', group.id);
    const moved = await createWorkstream('Flowers', group.id);

    await moveToGroup(moved.id, null);

    expect(await scopeOrder(null)).toEqual([
      ['Flowers', 0],
      ['Venue', 1],
    ]);
    expect(await scopeOrder(group.id)).toEqual([['Music', 0]]);
  });

  it('leaves positions untouched when an update keeps the same group', async () => {
    const group = await createGroup('Vendors');
    await createWorkstream('Venue', group.id);
    const kept = await createWorkstream('Music', group.id);

    await request(app.getHttpServer() as never)
      .patch(`/workstreams/${kept.id}`)
      .set('Authorization', authorization)
      .send({ name: 'Music & DJ', groupId: group.id })
      .expect(200);

    expect(await scopeOrder(group.id)).toEqual([
      ['Music & DJ', 0],
      ['Venue', 1],
    ]);
  });

  describe('group order', () => {
    it('rewrites the group positions to the submitted order', async () => {
      const first = await createGroup('Vendors');
      const second = await createGroup('Logistics');
      const third = await createGroup('Attire');

      const response = await reorderGroups([
        third.id,
        first.id,
        second.id,
      ]).expect(200);

      expect(
        (response.body as GroupDto[]).map(({ name, position }) => [
          name,
          position,
        ]),
      ).toEqual([
        ['Attire', 0],
        ['Vendors', 1],
        ['Logistics', 2],
      ]);

      const overview = await fetchOverview();
      expect(overview.groups.map((group) => group.name)).toEqual([
        'Attire',
        'Vendors',
        'Logistics',
      ]);
    });

    it('closes the holes a deleted group left in the sequence', async () => {
      const first = await createGroup('Vendors');
      const middle = await createGroup('Logistics');
      const last = await createGroup('Attire');

      await request(app.getHttpServer() as never)
        .delete(`/groups/${middle.id}`)
        .set('Authorization', authorization)
        .expect(204);

      const response = await reorderGroups([first.id, last.id]).expect(200);

      expect(
        (response.body as GroupDto[]).map((group) => group.position),
      ).toEqual([0, 1]);
    });

    it('returns the same order when the request is resubmitted', async () => {
      const first = await createGroup('Vendors');
      const second = await createGroup('Logistics');

      await reorderGroups([second.id, first.id]).expect(200);
      const response = await reorderGroups([second.id, first.id]).expect(200);

      expect(
        (response.body as GroupDto[]).map(({ name, position }) => [
          name,
          position,
        ]),
      ).toEqual([
        ['Logistics', 0],
        ['Vendors', 1],
      ]);
    });

    it('rejects ids that are not exactly the project groups', async () => {
      const first = await createGroup('Vendors');
      const second = await createGroup('Logistics');
      const foreign = await createGroup('Attire', await createProject());

      const payloads = [
        [first.id],
        [first.id, second.id, foreign.id],
        [first.id, first.id],
      ];

      for (const ids of payloads) {
        const response = await reorderGroups(ids).expect(409);
        expect(response.body).toMatchObject({
          type: 'https://api.example.com/errors/order-mismatch',
        });
      }

      const overview = await fetchOverview();
      expect(
        overview.groups.map((group) => [group.name, group.position]),
      ).toEqual([
        ['Vendors', 0],
        ['Logistics', 1],
      ]);
    });
  });

  describe('workstream order', () => {
    it('rewrites a group scope to the submitted order', async () => {
      const group = await createGroup('Vendors');
      const venue = await createWorkstream('Venue', group.id);
      const music = await createWorkstream('Music', group.id);
      const flowers = await createWorkstream('Flowers', group.id);

      const response = await reorderWorkstreams(group.id, [
        venue.id,
        flowers.id,
        music.id,
      ]).expect(200);

      expect(
        (response.body as WorkstreamDto[]).map(({ name, position }) => [
          name,
          position,
        ]),
      ).toEqual([
        ['Venue', 0],
        ['Flowers', 1],
        ['Music', 2],
      ]);
      expect(await scopeOrder(group.id)).toEqual([
        ['Venue', 0],
        ['Flowers', 1],
        ['Music', 2],
      ]);
    });

    it('rewrites the ungrouped scope without touching a group scope', async () => {
      const group = await createGroup('Vendors');
      const venue = await createWorkstream('Venue');
      const flowers = await createWorkstream('Flowers');
      await createWorkstream('Music', group.id);

      await reorderWorkstreams(null, [venue.id, flowers.id]).expect(200);

      expect(await scopeOrder(null)).toEqual([
        ['Venue', 0],
        ['Flowers', 1],
      ]);
      expect(await scopeOrder(group.id)).toEqual([['Music', 0]]);
    });

    it('returns the same order when the request is resubmitted', async () => {
      const venue = await createWorkstream('Venue');
      const flowers = await createWorkstream('Flowers');

      await reorderWorkstreams(null, [venue.id, flowers.id]).expect(200);
      const response = await reorderWorkstreams(null, [
        venue.id,
        flowers.id,
      ]).expect(200);

      expect(
        (response.body as WorkstreamDto[]).map(({ name, position }) => [
          name,
          position,
        ]),
      ).toEqual([
        ['Venue', 0],
        ['Flowers', 1],
      ]);
    });

    it('trails the complete workstreams behind the reordered live ones', async () => {
      const group = await createGroup('Vendors');
      await createCompleteWorkstream('Rings', group.id, 0);
      await createCompleteWorkstream('Save the date', group.id, 1);
      const venue = await createWorkstream('Venue', group.id);
      const music = await createWorkstream('Music', group.id);

      const response = await reorderWorkstreams(group.id, [
        venue.id,
        music.id,
      ]).expect(200);

      expect(
        (response.body as WorkstreamDto[]).map(({ name }) => name),
      ).toEqual(['Venue', 'Music']);
      expect(await scopeOrder(group.id)).toEqual([
        ['Venue', 0],
        ['Music', 1],
        ['Rings', 2],
        ['Save the date', 3],
      ]);
    });

    it('rejects a complete workstream submitted among the live ids', async () => {
      const group = await createGroup('Vendors');
      const complete = await createCompleteWorkstream('Rings', group.id, 0);
      const venue = await createWorkstream('Venue', group.id);

      const response = await reorderWorkstreams(group.id, [
        venue.id,
        complete,
      ]).expect(409);

      expect(response.body).toMatchObject({
        type: 'https://api.example.com/errors/order-mismatch',
      });
    });

    it('rejects ids that are not exactly the live scope membership', async () => {
      const group = await createGroup('Vendors');
      const venue = await createWorkstream('Venue', group.id);
      const music = await createWorkstream('Music', group.id);
      const ungrouped = await createWorkstream('Flowers');

      const payloads = [
        [venue.id],
        [venue.id, music.id, ungrouped.id],
        [venue.id, venue.id],
      ];

      for (const ids of payloads) {
        const response = await reorderWorkstreams(group.id, ids).expect(409);
        expect(response.body).toMatchObject({
          type: 'https://api.example.com/errors/order-mismatch',
        });
      }

      expect(await scopeOrder(group.id)).toEqual([
        ['Music', 0],
        ['Venue', 1],
      ]);
    });

    it('rejects ids from another project', async () => {
      const otherProjectId = await createProject();
      const venue = await createWorkstream('Venue');
      const foreign = await createWorkstream('Foreign', null, otherProjectId);

      const response = await reorderWorkstreams(null, [
        venue.id,
        foreign.id,
      ]).expect(409);

      expect(response.body).toMatchObject({
        type: 'https://api.example.com/errors/order-mismatch',
      });
    });

    it('rejects a group scope from another project', async () => {
      const foreignGroup = await createGroup('Vendors', await createProject());
      const venue = await createWorkstream('Venue');

      await reorderWorkstreams(foreignGroup.id, [venue.id]).expect(404);
    });
  });
});
