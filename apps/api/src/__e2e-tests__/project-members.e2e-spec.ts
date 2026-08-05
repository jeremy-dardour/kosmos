import request from 'supertest';

import { createTestApp } from '@/__e2e-tests__/helpers/create-app.helper';
import { MockTokenFactory } from '@/__e2e-tests__/helpers/mock-token.factory';
import {
  resetDatabase,
  testEntityManager,
} from '@/__e2e-tests__/helpers/reset-database.helper';
import { signIn } from '@/__e2e-tests__/helpers/sign-in.helper';
import { MockOidcService } from '@/__e2e-tests__/mocks/mock-oidc.service';
import { ProjectMember } from '@/database/entities/project-member.entity';
import { Project } from '@/database/entities/project.entity';

import type { MemberDto } from '@/modules/project/dtos/output/member.dto';
import type { ProjectDto } from '@/modules/project/dtos/output/project.dto';
import type { SqlEntityManager } from '@mikro-orm/postgresql';
import type { INestApplication } from '@nestjs/common';
import type { Test as SuperTestType } from 'supertest';
import type TestAgent from 'supertest/lib/agent';

function createRequest(app: INestApplication): TestAgent<SuperTestType> {
  return request(app.getHttpServer() as never);
}

function expectSlug(body: unknown, slug: string): void {
  expect((body as { type: string }).type).toMatch(
    new RegExp(`/errors/${slug}$`),
  );
}

// All in `.env.e2e`'s AUTH_ALLOWED_EMAILS so their tokens pass the allow-list.
const OWNER_EMAIL = 'tenant-a@example.com';
const MEMBER_EMAIL = 'tenant-b@example.com';
const INVITED_EMAIL = 'tenant-pending@example.com';

describe('Project Members E2E Tests', () => {
  const mockOidc = new MockOidcService();
  let tokenFactory: MockTokenFactory;
  let app: INestApplication;
  let em: SqlEntityManager;
  let authOwner: string;
  let projectId: string;

  beforeAll(async () => {
    await mockOidc.setup();
    tokenFactory = new MockTokenFactory(mockOidc, process.env.AUTH_CLIENT_ID!);
  });

  beforeEach(async () => {
    app = await createTestApp({ oidcOverride: mockOidc });
    em = testEntityManager(app);
    await resetDatabase(em);

    authOwner = await tokenFor(OWNER_EMAIL);
    await signIn(app, authOwner);

    const response = await createRequest(app)
      .post('/projects')
      .set('Authorization', authOwner)
      .send({ name: 'Launch' })
      .expect(201);
    projectId = (response.body as ProjectDto).id;
  });

  afterEach(async () => {
    await app.close();
  });

  async function tokenFor(email: string): Promise<string> {
    return `Bearer ${await tokenFactory.createToken({ email })}`;
  }

  async function addMember(auth: string, email: string): Promise<MemberDto> {
    const response = await createRequest(app)
      .post(`/projects/${projectId}/members`)
      .set('Authorization', auth)
      .send({ email })
      .expect(201);

    return response.body as MemberDto;
  }

  async function listMembers(auth: string): Promise<MemberDto[]> {
    const response = await createRequest(app)
      .get(`/projects/${projectId}/members`)
      .set('Authorization', auth)
      .expect(200);

    return response.body as MemberDto[];
  }

  it('runs the full membership journey: pending add, claim, leave, remove', async () => {
    // Owner adds an email with no account yet → pending row.
    const pending = await addMember(authOwner, INVITED_EMAIL);
    expect(pending).toMatchObject({
      email: INVITED_EMAIL,
      userId: null,
      isOwner: false,
    });

    // First sign-in claims the pending membership; the project shows up.
    const authInvited = await tokenFor(INVITED_EMAIL);
    const invitedUser = await signIn(app, authInvited);

    const members = await listMembers(authInvited);
    expect(members).toHaveLength(2);
    const invitedRow = members.find((m) => m.email === INVITED_EMAIL);
    expect(invitedRow).toMatchObject({
      userId: invitedUser.id,
      isOwner: false,
    });
    expect(members.find((m) => m.email === OWNER_EMAIL)).toMatchObject({
      isOwner: true,
    });

    const projects = await createRequest(app)
      .get('/projects')
      .set('Authorization', authInvited)
      .expect(200);
    expect((projects.body as ProjectDto[]).map((p) => p.id)).toContain(
      projectId,
    );

    // The member leaves: DELETE on their own row revokes access immediately.
    await createRequest(app)
      .delete(`/projects/${projectId}/members/${invitedRow!.id}`)
      .set('Authorization', authInvited)
      .expect(204);
    await createRequest(app)
      .get(`/projects/${projectId}`)
      .set('Authorization', authInvited)
      .expect(404);

    // Owner removes a joined member; their access is revoked immediately.
    const authMember = await tokenFor(MEMBER_EMAIL);
    await signIn(app, authMember);
    const joined = await addMember(authOwner, MEMBER_EMAIL);
    expect(joined.userId).not.toBeNull();

    await createRequest(app)
      .get(`/projects/${projectId}`)
      .set('Authorization', authMember)
      .expect(200);
    await createRequest(app)
      .delete(`/projects/${projectId}/members/${joined.id}`)
      .set('Authorization', authOwner)
      .expect(204);
    await createRequest(app)
      .get(`/projects/${projectId}`)
      .set('Authorization', authMember)
      .expect(404);
  });

  it('joins immediately when the invited email already has an account', async () => {
    const authMember = await tokenFor(MEMBER_EMAIL);
    const memberUser = await signIn(app, authMember);

    const added = await addMember(authOwner, MEMBER_EMAIL);
    expect(added.userId).toBe(memberUser.id);
  });

  it('normalizes the invited email to lowercase', async () => {
    const added = await addMember(authOwner, 'Tenant-Pending@Example.COM');
    expect(added.email).toBe(INVITED_EMAIL);
  });

  it('rejects adding an email that is already a member with 409 duplicate-member', async () => {
    const response = await createRequest(app)
      .post(`/projects/${projectId}/members`)
      .set('Authorization', authOwner)
      .send({ email: OWNER_EMAIL })
      .expect(409);

    expectSlug(response.body, 'duplicate-member');
  });

  it('rejects the 21st member with 409 member-limit-reached, but still reports duplicates', async () => {
    const project = await em.findOneOrFail(Project, { id: projectId });
    for (let i = 0; i < 19; i += 1) {
      em.create(ProjectMember, {
        project,
        email: `helper-${i}@example.com`,
        user: null,
      });
    }
    await em.flush();

    const capped = await createRequest(app)
      .post(`/projects/${projectId}/members`)
      .set('Authorization', authOwner)
      .send({ email: INVITED_EMAIL })
      .expect(409);
    expectSlug(capped.body, 'member-limit-reached');

    // Duplicate wins over the cap at capacity.
    const duplicate = await createRequest(app)
      .post(`/projects/${projectId}/members`)
      .set('Authorization', authOwner)
      .send({ email: 'helper-3@example.com' })
      .expect(409);
    expectSlug(duplicate.body, 'duplicate-member');
  });

  it("rejects removing the owner's row with 409 cannot-remove-owner, for owner and member alike", async () => {
    const authMember = await tokenFor(MEMBER_EMAIL);
    await signIn(app, authMember);
    await addMember(authOwner, MEMBER_EMAIL);

    const members = await listMembers(authOwner);
    const ownerRow = members.find((m) => m.isOwner)!;

    const asOwner = await createRequest(app)
      .delete(`/projects/${projectId}/members/${ownerRow.id}`)
      .set('Authorization', authOwner)
      .expect(409);
    expectSlug(asOwner.body, 'cannot-remove-owner');

    const asMember = await createRequest(app)
      .delete(`/projects/${projectId}/members/${ownerRow.id}`)
      .set('Authorization', authMember)
      .expect(409);
    expectSlug(asMember.body, 'cannot-remove-owner');
  });

  it('rejects membership management by a non-owner member with 403 not-project-owner', async () => {
    const authMember = await tokenFor(MEMBER_EMAIL);
    await signIn(app, authMember);
    const added = await addMember(authOwner, MEMBER_EMAIL);

    const add = await createRequest(app)
      .post(`/projects/${projectId}/members`)
      .set('Authorization', authMember)
      .send({ email: INVITED_EMAIL })
      .expect(403);
    expectSlug(add.body, 'not-project-owner');

    // A member also cannot remove someone else's row — only their own.
    const pending = await addMember(authOwner, INVITED_EMAIL);
    const remove = await createRequest(app)
      .delete(`/projects/${projectId}/members/${pending.id}`)
      .set('Authorization', authMember)
      .expect(403);
    expectSlug(remove.body, 'not-project-owner');
    expect(added.userId).not.toBeNull();
  });

  it('404s a member id that belongs to another project', async () => {
    const other = await createRequest(app)
      .post('/projects')
      .set('Authorization', authOwner)
      .send({ name: 'Other' })
      .expect(201);
    const otherId = (other.body as ProjectDto).id;
    const otherMembers = await createRequest(app)
      .get(`/projects/${otherId}/members`)
      .set('Authorization', authOwner)
      .expect(200);
    const foreignRow = (otherMembers.body as MemberDto[])[0]!;

    await createRequest(app)
      .delete(`/projects/${projectId}/members/${foreignRow.id}`)
      .set('Authorization', authOwner)
      .expect(404);
  });
});
