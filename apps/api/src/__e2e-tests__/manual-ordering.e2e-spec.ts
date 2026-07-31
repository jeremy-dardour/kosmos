import request from 'supertest';

import { createTestApp } from '@/__e2e-tests__/helpers/create-app.helper';
import { MockTokenFactory } from '@/__e2e-tests__/helpers/mock-token.factory';
import {
  resetDatabase,
  testEntityManager,
} from '@/__e2e-tests__/helpers/reset-database.helper';
import { MockOidcService } from '@/__e2e-tests__/mocks/mock-oidc.service';

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

    const response = await request(app.getHttpServer() as never)
      .post('/projects')
      .set('Authorization', authorization)
      .send({ name: 'Wedding Prep' })
      .expect(201);

    projectId = (response.body as ProjectDto).id;
  });

  afterEach(async () => {
    await app.close();
  });

  async function createGroup(name: string): Promise<GroupDto> {
    const response = await request(app.getHttpServer() as never)
      .post(`/projects/${projectId}/groups`)
      .set('Authorization', authorization)
      .send({ name, color: '#5a9e6f' })
      .expect(201);

    return response.body as GroupDto;
  }

  async function createWorkstream(
    name: string,
    groupId: string | null = null,
  ): Promise<WorkstreamDto> {
    const response = await request(app.getHttpServer() as never)
      .post(`/projects/${projectId}/workstreams`)
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
});
