import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import type { Overview, Workstream } from '@/api/hooks/use-overview';

const API_BASE = 'http://localhost:3000';

export const server = setupServer();

type AdvanceResponse = Record<string, unknown>;

interface AdvanceRequest {
  body: unknown;
  overview: Overview;
}

export function setupOverviewApi(initialOverview: Overview) {
  let overview = initialOverview;

  server.use(
    http.get(`${API_BASE}/api/projects`, () =>
      HttpResponse.json([overview.project]),
    ),
    http.get(`${API_BASE}/api/projects/:id/overview`, () =>
      HttpResponse.json(overview),
    ),
  );

  return {
    updateWorkstream(
      id: string,
      update: (workstream: Workstream) => Workstream,
    ) {
      overview = {
        ...overview,
        workstreams: overview.workstreams.map((workstream) =>
          workstream.id === id ? update(workstream) : workstream,
        ),
      };
    },

    mockAdvance(
      id: string,
      handle: (
        request: AdvanceRequest,
      ) => AdvanceResponse | Promise<AdvanceResponse>,
    ) {
      server.use(
        http.post(
          `${API_BASE}/api/workstreams/${id}/advance`,
          async ({ request }) => {
            const response = await handle({
              body: await request.json(),
              overview,
            });
            return HttpResponse.json(response);
          },
        ),
      );
    },

    mockAdvanceError(
      id: string,
      status: number,
      problem: Record<string, unknown>,
    ) {
      server.use(
        http.post(`${API_BASE}/api/workstreams/${id}/advance`, () =>
          HttpResponse.json(problem, { status }),
        ),
      );
    },
  };
}
