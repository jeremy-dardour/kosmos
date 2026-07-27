import { resolveOwner } from '@/modules/project/utils/resolve-owner.util';

import type { User } from '@/database/entities/user.entity';

const stepOwner = { id: 'step-owner' } as User;
const workstreamOwner = { id: 'workstream-owner' } as User;

describe('resolveOwner', () => {
  it("prefers the step's own owner", () => {
    expect(resolveOwner({ owner: stepOwner }, { owner: workstreamOwner })).toBe(
      stepOwner,
    );
  });

  it("inherits the workstream's owner when the step has none", () => {
    expect(resolveOwner({ owner: null }, { owner: workstreamOwner })).toBe(
      workstreamOwner,
    );
  });

  it('resolves to null when neither is assigned', () => {
    expect(resolveOwner({ owner: null }, { owner: null })).toBeNull();
  });
});
