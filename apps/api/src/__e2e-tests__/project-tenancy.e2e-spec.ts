import request from 'supertest';

import { createTestApp } from '@/__e2e-tests__/helpers/create-app.helper';
import { MockTokenFactory } from '@/__e2e-tests__/helpers/mock-token.factory';
import { createProjectFixture } from '@/__e2e-tests__/helpers/project-fixture.helper';
import {
  resetDatabase,
  testEntityManager,
} from '@/__e2e-tests__/helpers/reset-database.helper';
import { signIn } from '@/__e2e-tests__/helpers/sign-in.helper';
import { MockOidcService } from '@/__e2e-tests__/mocks/mock-oidc.service';
import { ProjectMember } from '@/database/entities/project-member.entity';
import { Project } from '@/database/entities/project.entity';
import { User } from '@/database/entities/user.entity';

import type { ProjectDto } from '@/modules/project/dtos/output/project.dto';
import type { SqlEntityManager } from '@mikro-orm/postgresql';
import type { INestApplication } from '@nestjs/common';
import type { Test as SuperTestType } from 'supertest';
import type TestAgent from 'supertest/lib/agent';

function createRequest(app: INestApplication): TestAgent<SuperTestType> {
  return request(app.getHttpServer() as never);
}

// These actors are in `.env.e2e`'s AUTH_ALLOWED_EMAILS so their per-email
// tokens pass the OIDC allow-list check.
const TENANT_A_EMAIL = 'tenant-a@example.com';
const TENANT_B_EMAIL = 'tenant-b@example.com';
const PENDING_EMAIL = 'tenant-pending@example.com';
const STALE_EMAIL = 'tenant-stale@example.com';

describe('Project Tenancy E2E Tests', () => {
  const mockOidc = new MockOidcService();
  let tokenFactory: MockTokenFactory;
  let app: INestApplication;
  let em: SqlEntityManager;

  beforeAll(async () => {
    await mockOidc.setup();
    tokenFactory = new MockTokenFactory(mockOidc, process.env.AUTH_CLIENT_ID!);
  });

  beforeEach(async () => {
    app = await createTestApp({ oidcOverride: mockOidc });
    em = testEntityManager(app);

    await resetDatabase(em);
  });

  afterEach(async () => {
    await app.close();
  });

  async function tokenFor(email: string): Promise<string> {
    return `Bearer ${await tokenFactory.createToken({ email })}`;
  }

  async function createProjectAs(
    auth: string,
    name: string,
  ): Promise<ProjectDto> {
    const response = await createRequest(app)
      .post('/projects')
      .set('Authorization', auth)
      .send({ name })
      .expect(201);

    return response.body as ProjectDto;
  }

  async function listProjects(auth: string): Promise<ProjectDto[]> {
    const response = await createRequest(app)
      .get('/projects')
      .set('Authorization', auth)
      .expect(200);

    return response.body as ProjectDto[];
  }

  it('scopes GET /projects to the projects the actor owns', async () => {
    const authA = await tokenFor(TENANT_A_EMAIL);
    const authB = await tokenFor(TENANT_B_EMAIL);
    await signIn(app, authA);
    await signIn(app, authB);

    const projectA = await createProjectAs(authA, 'Tenant A Wedding');
    const projectB = await createProjectAs(authB, 'Tenant B Wedding');

    const listA = await listProjects(authA);
    const listB = await listProjects(authB);
    expect(listA.map((p) => p.id)).toEqual([projectA.id]);
    expect(listB.map((p) => p.id)).toEqual([projectB.id]);
  });

  it('creates the project owned by the actor and joins them as a member', async () => {
    const auth = await tokenFor(TENANT_A_EMAIL);
    const currentUser = await signIn(app, auth);

    const created = await createProjectAs(auth, 'Tenant A Wedding');
    expect(created.ownerId).toBe(currentUser.id);
    expect(created.deletedAt).toBeNull();

    const member = await em.findOneOrFail(
      ProjectMember,
      { project: created.id, email: TENANT_A_EMAIL },
      { populate: ['user'] },
    );
    expect(member.user?.id).toBe(currentUser.id);
  });

  it('rejects a 21st owned project with a typed conflict', async () => {
    const auth = await tokenFor(TENANT_A_EMAIL);
    const currentUser = await signIn(app, auth);
    const owner = await em.findOneOrFail(User, { id: currentUser.id });

    for (let i = 0; i < 20; i += 1) {
      const project = em.create(Project, { name: `Owned ${i}`, owner });
      em.create(ProjectMember, { project, email: owner.email, user: owner });
    }
    await em.flush();

    const response = await createRequest(app)
      .post('/projects')
      .set('Authorization', auth)
      .send({ name: 'One too many' })
      .expect(409);

    expect((response.body as { type: string }).type).toMatch(
      /\/errors\/project-limit-reached$/,
    );
  });

  it('claims a pending membership when the invited email first signs in', async () => {
    const project = createProjectFixture(em);
    await em.flush();
    em.create(ProjectMember, { project, email: PENDING_EMAIL, user: null });
    await em.flush();

    const auth = await tokenFor(PENDING_EMAIL);
    const currentUser = await signIn(app, auth);

    const member = await em.findOneOrFail(
      ProjectMember,
      { project: project.id, email: PENDING_EMAIL },
      { refresh: true, populate: ['user'] },
    );
    expect(member.user?.id).toBe(currentUser.id);

    const list = await listProjects(auth);
    expect(list.map((p) => p.id)).toContain(project.id);
  });

  it('returns 401 for GET /projects when the actor email has no user row', async () => {
    const auth = await tokenFor(STALE_EMAIL);

    await createRequest(app)
      .get('/projects')
      .set('Authorization', auth)
      .expect(401);
  });
});
