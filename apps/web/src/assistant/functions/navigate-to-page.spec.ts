import { describe, expect, it, vi } from 'vitest';

import { navigateToPageFunction } from '@/assistant/functions/navigate-to-page';

const call = (arguments_: Record<string, unknown>) => {
  const navigate = vi.fn();
  const result = navigateToPageFunction(navigate).handler(arguments_) as Record<
    string,
    unknown
  >;
  return { navigate, result };
};

describe('navigateToPage', () => {
  it('fills the path placeholders and navigates', () => {
    const { navigate, result } = call({
      page: 'projectOverview',
      projectId: 'p1',
    });

    expect(navigate).toHaveBeenCalledWith('/projects/p1');
    expect(result).toMatchObject({
      success: true,
      navigatedTo: '/projects/p1',
      page: 'projectOverview',
    });
  });

  it('tells the model that navigating ends its turn', () => {
    const { result } = call({ page: 'projectList' });

    const { description } = navigateToPageFunction(vi.fn());

    expect(String(result.next)).toContain('ends your turn');
    expect(description).toContain('ends your turn');
  });

  it('asks for a missing placeholder instead of navigating', () => {
    const { navigate, result } = call({ page: 'projectOverview' });

    expect(navigate).not.toHaveBeenCalled();
    expect(String(result.error)).toContain('"projectId"');
  });

  it('reports an unknown page', () => {
    const { navigate, result } = call({ page: 'settings' });

    expect(navigate).not.toHaveBeenCalled();
    expect(String(result.error)).toContain('Unknown page');
  });
});
