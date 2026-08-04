import { describe, expect, it, vi } from 'vitest';

import { ProjectMember } from '@/database/entities/project-member.entity';
import { User } from '@/database/entities/user.entity';
import { UserRepository } from '@/database/repositories/user.repository';

const PROFILE = {
  email: 'someone@example.com',
  name: 'Someone',
  avatarUrl: null,
};

function createRepository() {
  const user = new User();
  user.id = 'user-1';
  user.email = PROFILE.email;

  const transactionalEm = {
    upsert: vi.fn(() => user),
    nativeUpdate: vi.fn(),
  };
  const em = {
    transactional: vi.fn(
      async (work: (fork: typeof transactionalEm) => Promise<User>) =>
        work(transactionalEm),
    ),
  };

  return {
    repository: new UserRepository(em as never),
    transactionalEm,
    user,
  };
}

describe('userRepository.upsertProfile', () => {
  it('claims the pending memberships of the email it provisions', async () => {
    const { repository, transactionalEm, user } = createRepository();

    const provisioned = await repository.upsertProfile(PROFILE);

    expect(provisioned).toBe(user);
    expect(transactionalEm.nativeUpdate).toHaveBeenCalledWith(
      ProjectMember,
      { email: PROFILE.email, user: null },
      expect.objectContaining({ user: 'user-1' }),
    );
  });

  it('normalizes a mixed-case email before upserting and claiming', async () => {
    const { repository, transactionalEm } = createRepository();

    await repository.upsertProfile({
      ...PROFILE,
      email: 'Someone@Example.COM',
    });

    expect(transactionalEm.upsert).toHaveBeenCalledWith(
      User,
      expect.objectContaining({ email: PROFILE.email }),
      expect.anything(),
    );
    expect(transactionalEm.nativeUpdate).toHaveBeenCalledWith(
      ProjectMember,
      { email: PROFILE.email, user: null },
      expect.objectContaining({ user: 'user-1' }),
    );
  });
});
