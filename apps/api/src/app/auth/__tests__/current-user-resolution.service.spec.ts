import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { CurrentUserResolutionService } from '@/app/auth/current-user-resolution.service';
import { User } from '@/database/entities/user.entity';

function buildUser(): User {
  const user = new User();
  user.id = 'user-1';
  user.email = 'someone@example.com';
  user.name = 'Someone';

  return user;
}

describe('currentUserResolutionService', () => {
  it('resolves the persisted user by normalized email', async () => {
    const user = buildUser();
    const findOne = vi.fn(() => user);
    const service = new CurrentUserResolutionService({ findOne } as never);

    const resolved = await service.resolve({ email: 'Someone@Example.com' });

    expect(resolved).toBe(user);
    expect(findOne).toHaveBeenCalledWith({ email: 'someone@example.com' });
  });

  it('rejects a session whose account no longer exists', async () => {
    const service = new CurrentUserResolutionService({
      findOne: vi.fn(() => null),
    } as never);

    await expect(
      service.resolve({ email: 'ghost@example.com' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
