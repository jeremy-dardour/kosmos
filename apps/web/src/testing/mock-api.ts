import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import type { Overview, Workstream } from '@/api/hooks/use-overview';
import type { UpdatePipelineInput } from '@/api/hooks/use-update-pipeline';

const API_BASE = 'http://localhost:3000';

export const server = setupServer();

type AdvanceResponse = Record<string, unknown>;

interface AdvanceRequest {
  body: unknown;
  overview: Overview;
}

export function setupOverviewApi(initialOverview: Overview) {
  let overview = initialOverview;
  let generatedId = 0;

  server.use(
    http.get(`${API_BASE}/api/projects`, () =>
      HttpResponse.json([overview.project]),
    ),
    http.get(`${API_BASE}/api/projects/:id/overview`, () =>
      HttpResponse.json(overview),
    ),
    http.get(`${API_BASE}/api/workstreams/:id/notes`, () =>
      HttpResponse.json([]),
    ),
    http.put(
      `${API_BASE}/api/workstreams/:id/pipeline`,
      async ({ params, request }) => {
        const input = (await request.json()) as UpdatePipelineInput;
        const workstreamId = String(params.id);
        const workstream = overview.workstreams.find(
          (item) => item.id === workstreamId,
        );
        if (!workstream) {
          return HttpResponse.json({ status: 404 }, { status: 404 });
        }

        const pastSteps = workstream.steps.filter(
          (step) => step.status === 'done' || step.status === 'skipped',
        );
        const existingById = new Map(
          workstream.steps.map((step) => [step.id, step]),
        );
        const updatedAt = new Date(
          new Date(workstream.updatedAt).getTime() + 1000,
        ).toISOString();
        const editableSteps = input.steps.map((submittedStep, index) => {
          const existing = submittedStep.id
            ? existingById.get(submittedStep.id)
            : null;
          const id =
            submittedStep.id ?? `mock-step-${workstreamId}-${++generatedId}`;

          return {
            id,
            name: submittedStep.name,
            position: pastSteps.length + index + 1,
            status:
              workstream.lifecycle === 'active' && index === 0
                ? ('in_progress' as const)
                : ('not_started' as const),
            blocked: submittedStep.blocked,
            deadline: submittedStep.deadline,
            outcome: null,
            outcomeAt: null,
            explicitOwnerId: submittedStep.ownerId,
            effectiveOwnerId: submittedStep.ownerId ?? workstream.ownerId,
            checklistItems: submittedStep.checklistItems.map(
              (submittedItem, itemIndex) => ({
                id:
                  submittedItem.id ??
                  `mock-item-${workstreamId}-${++generatedId}`,
                name: submittedItem.name,
                position: itemIndex + 1,
                done: submittedItem.done,
                createdAt: existing?.createdAt ?? updatedAt,
                updatedAt,
              }),
            ),
            createdAt: existing?.createdAt ?? updatedAt,
            updatedAt,
          };
        });
        const updatedWorkstream = {
          ...workstream,
          updatedAt,
          steps: [...pastSteps, ...editableSteps],
        };

        overview = {
          ...overview,
          workstreams: overview.workstreams.map((item) =>
            item.id === workstream.id ? updatedWorkstream : item,
          ),
        };
        return HttpResponse.json(updatedWorkstream);
      },
    ),
    http.patch(
      `${API_BASE}/api/checklist-items/:id`,
      async ({ params, request }) => {
        const input = (await request.json()) as { done: boolean };
        const updatedAt = new Date().toISOString();
        let responseItem:
          | Workstream['steps'][number]['checklistItems'][number]
          | null = null;

        overview = {
          ...overview,
          workstreams: overview.workstreams.map((workstream) => {
            let didChange = false;
            const steps = workstream.steps.map((step) => ({
              ...step,
              checklistItems: step.checklistItems.map((item) => {
                if (item.id !== params.id) return item;
                didChange = true;
                responseItem = { ...item, done: input.done, updatedAt };
                return responseItem;
              }),
            }));
            return didChange ? { ...workstream, steps, updatedAt } : workstream;
          }),
        };

        return responseItem
          ? HttpResponse.json(responseItem)
          : HttpResponse.json({ status: 404 }, { status: 404 });
      },
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
