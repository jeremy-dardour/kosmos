import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useOptionalAgoClient } from '@useago/sdk/react';
import { useEffect } from 'react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { routes } from '@/app/router';
import { defaultOverview } from '@/features/overview/__tests__/overview-integration.fixtures';
import { createMemoryStorage } from '@/testing/memory-storage';
import { setupOverviewApi } from '@/testing/mock-api';
import { renderWithApp } from '@/testing/render-with-app';

// The SDK's react entry redeclares AgoClient, so the class exported from
// `@useago/sdk` is a different (private-field-incompatible) type to the one
// the hook returns.
type AgoClient = NonNullable<ReturnType<typeof useOptionalAgoClient>>;

vi.mock('@/config/env', () => ({
  env: {
    apiUrl: 'http://localhost:3000',
    dev: true,
    fakeAuth: true,
    assistant: { baseUrl: 'https://assistant.test', agent: 'kosmos' },
  },
}));

interface CaptureAgoClientProperties {
  onClient: (client: AgoClient) => void;
}

const CaptureAgoClient = ({ onClient }: CaptureAgoClientProperties) => {
  const client = useOptionalAgoClient();

  useEffect(() => {
    if (client) onClient(client);
  }, [client, onClient]);

  return null;
};

const alphabetically = (left: string, right: string) =>
  left.localeCompare(right);

function renderAppAtProjectList() {
  const router = createMemoryRouter(routes, { initialEntries: ['/'] });
  let client: AgoClient | null = null;

  renderWithApp(
    <>
      <CaptureAgoClient
        onClient={(next) => {
          client = next;
        }}
      />
      <RouterProvider router={router} />
    </>,
  );

  return {
    functionNames: () =>
      (client?.getRegisteredFunctions() ?? [])
        .map((fn) => fn.name)
        .sort(alphabetically),
    contextKeys: () =>
      Object.keys(client?.getContextSnapshot()?.entries ?? {}).sort(
        alphabetically,
      ),
  };
}

describe('assistant registration', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers the overview surface on arrival and withdraws it on leave', async () => {
    setupOverviewApi(defaultOverview);
    const agent = userEvent.setup();
    const assistant = renderAppAtProjectList();

    const projectLink = await screen.findByRole('link', {
      name: /Our Wedding/,
    });
    expect(assistant.functionNames()).toEqual(['navigateToPage']);
    expect(assistant.contextKeys()).toEqual(
      expect.arrayContaining(['kosmos-guide', 'projects']),
    );

    await agent.click(projectLink);

    expect(
      await screen.findByRole('button', { name: 'Rename Catering' }),
    ).toBeVisible();
    expect(assistant.functionNames()).toEqual([
      'addSteps',
      'createWorkstream',
      'getWorkstream',
      'navigateToPage',
      'setPageState',
      'updateStep',
    ]);
    expect(assistant.contextKeys()).toEqual(
      expect.arrayContaining(['kosmos-guide', 'project', 'workstreams']),
    );
    expect(assistant.contextKeys()).not.toContain('projects');

    await agent.click(screen.getByRole('link', { name: 'Kosmos home' }));

    expect(
      await screen.findByRole('link', { name: /Our Wedding/ }),
    ).toBeVisible();
    expect(assistant.functionNames()).toEqual(['navigateToPage']);
    const keys = assistant.contextKeys();
    expect(keys).toEqual(expect.arrayContaining(['kosmos-guide', 'projects']));
    expect(keys).not.toContain('project');
    expect(keys).not.toContain('workstreams');
  });
});
