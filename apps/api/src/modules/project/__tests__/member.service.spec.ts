import { HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { User } from '@/database/entities/user.entity';
import { MemberService } from '@/modules/project/member.service';
import { ProblemDetailsException } from '@/shared/exceptions/problem-details.exception';

import type { ProjectMember } from '@/database/entities/project-member.entity';
import type {
  AddMemberContext,
  RemoveMemberContext,
} from '@/modules/project/repositories/member.repository';

const OWNER_ID = 'owner-1';
const MEMBER_ID = 'member-user-1';

function buildUser(id: string): User {
  const user = new User();
  user.id = id;
  user.email = `${id}@example.com`;
  user.name = id;

  return user;
}

function buildMemberRow(userId: string | null): ProjectMember {
  return { id: 'row-1', user: userId ? buildUser(userId) : null } as never;
}

function createService(context: Partial<AddMemberContext>) {
  const memberRepository = {
    addMember: vi.fn(
      (
        _projectId: string,
        _currentUserId: string,
        email: string,
        decide: (context: AddMemberContext) => void,
      ) => {
        decide({
          ownerId: OWNER_ID,
          existing: null,
          memberCount: 1,
          ...context,
        });

        return Promise.resolve({ email });
      },
    ),
    removeMember: vi.fn(
      (
        _projectId: string,
        _currentUserId: string,
        _memberId: string,
        decide: (context: RemoveMemberContext) => void,
      ) => {
        decide(context as RemoveMemberContext);

        return Promise.resolve();
      },
    ),
  };

  const configService = { get: vi.fn(() => 20) };

  return {
    service: new MemberService(
      memberRepository as never,
      configService as never,
    ),
    memberRepository,
  };
}

describe('memberService.add', () => {
  it('lowercases the email before it reaches the repository', async () => {
    const { service, memberRepository } = createService({});

    await service.add(
      'p1',
      { email: 'Helper@Example.COM' },
      buildUser(OWNER_ID),
    );

    expect(memberRepository.addMember).toHaveBeenCalledWith(
      'p1',
      OWNER_ID,
      'helper@example.com',
      expect.any(Function),
    );
  });

  it('rejects a non-owner with 403 not-project-owner', async () => {
    const { service } = createService({});

    const add = service.add(
      'p1',
      { email: 'helper@example.com' },
      buildUser(MEMBER_ID),
    );

    await expect(add).rejects.toMatchObject({
      typeSlug: 'not-project-owner',
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('reports duplicate-member over member-limit-reached at capacity', async () => {
    const { service } = createService({
      existing: buildMemberRow(MEMBER_ID),
      memberCount: 20,
    });

    const add = service.add(
      'p1',
      { email: 'helper@example.com' },
      buildUser(OWNER_ID),
    );

    await expect(add).rejects.toMatchObject({
      typeSlug: 'duplicate-member',
      status: HttpStatus.CONFLICT,
    });
  });

  it('refuses to exceed the member cap', async () => {
    const { service } = createService({ memberCount: 20 });

    const add = service.add(
      'p1',
      { email: 'helper@example.com' },
      buildUser(OWNER_ID),
    );

    await expect(add).rejects.toMatchObject({
      typeSlug: 'member-limit-reached',
      status: HttpStatus.CONFLICT,
    });
  });
});

describe('memberService.remove', () => {
  it("rejects removing the owner's row before the permission branch", async () => {
    // A non-owner targeting the owner's row gets the 409, not the 403.
    const { service } = createService({
      ownerId: OWNER_ID,
      member: buildMemberRow(OWNER_ID),
    } as never);

    const remove = service.remove('p1', 'row-1', buildUser(MEMBER_ID));

    await expect(remove).rejects.toMatchObject({
      typeSlug: 'cannot-remove-owner',
      status: HttpStatus.CONFLICT,
    });
  });

  it('rejects a member removing a row that is not their own', async () => {
    const { service } = createService({
      ownerId: OWNER_ID,
      member: buildMemberRow('someone-else'),
    } as never);

    const remove = service.remove('p1', 'row-1', buildUser(MEMBER_ID));

    await expect(remove).rejects.toMatchObject({
      typeSlug: 'not-project-owner',
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('lets a member remove their own row (leave)', async () => {
    const { service } = createService({
      ownerId: OWNER_ID,
      member: buildMemberRow(MEMBER_ID),
    } as never);

    await expect(
      service.remove('p1', 'row-1', buildUser(MEMBER_ID)),
    ).resolves.toBeUndefined();
  });

  it('lets the owner remove a pending row', async () => {
    const { service } = createService({
      ownerId: OWNER_ID,
      member: buildMemberRow(null),
    } as never);

    await expect(
      service.remove('p1', 'row-1', buildUser(OWNER_ID)),
    ).resolves.toBeUndefined();
  });
});

describe('problem details', () => {
  it('throws ProblemDetailsException instances', async () => {
    const { service } = createService({ memberCount: 20 });

    await expect(
      service.add('p1', { email: 'helper@example.com' }, buildUser(OWNER_ID)),
    ).rejects.toThrow(ProblemDetailsException);
  });
});
