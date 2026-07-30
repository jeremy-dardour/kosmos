import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import type { Overview, Workstream } from '@/api/hooks/use-overview';
import type { UpdatePipelineInput } from '@/api/hooks/use-update-pipeline';
import type {
  CreateNoteInput,
  NoteEntry,
  UpdateNoteInput,
} from '@/api/hooks/use-workstream-notes';

const API_BASE = 'http://localhost:3000';

export const server = setupServer();

type AdvanceResponse = Record<string, unknown>;
type ProblemOverrides = Partial<{
  type: string;
  title: string;
  detail: string;
  instance: string;
}>;

function problemDetails(
  status: number,
  overrides: ProblemOverrides = {},
): Record<string, unknown> {
  return {
    type: 'https://wedding-planner.dev/problems/not-found',
    title: 'Not Found',
    status,
    detail: 'The requested resource was not found',
    instance: '/api/testing',
    request_id: 'test-request-id',
    correlation_id: 'test-correlation-id',
    trace_id: 'test-trace-id',
    timestamp: '2026-07-28T12:00:00.000Z',
    ...overrides,
  };
}

function problemResponse(status: number, problem: Record<string, unknown>) {
  return HttpResponse.json(problem, {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

interface AdvanceRequest {
  body: unknown;
  overview: Overview;
}

export function setupOverviewApi(initialOverview: Overview) {
  let overview = initialOverview;
  let generatedId = 0;
  let lastPipelineInput: UpdatePipelineInput | null = null;

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
        lastPipelineInput = input;
        const workstreamId = String(params.id);
        const ws = overview.workstreams.find(
          (item) => item.id === workstreamId,
        );
        if (!ws) {
          return problemResponse(404, problemDetails(404));
        }

        const pastSteps = ws.steps.filter(
          (s) => s.status === 'done' || s.status === 'skipped',
        );
        const updatedAt = new Date(
          new Date(ws.updatedAt).getTime() + 1000,
        ).toISOString();
        const echoedSteps = input.steps.map((submitted, index) => ({
          id: submitted.id ?? `mock-step-${++generatedId}`,
          name: submitted.name,
          position: pastSteps.length + index + 1,
          status:
            ws.lifecycle === 'active' && index === 0
              ? ('in_progress' as const)
              : ('not_started' as const),
          blocked: submitted.blocked,
          deadline: submitted.deadline,
          outcome: null,
          outcomeAt: null,
          explicitOwnerId: submitted.ownerId,
          effectiveOwnerId: submitted.ownerId ?? ws.ownerId,
          checklistItems: submitted.checklistItems.map((item) => ({
            id: item.id ?? `mock-item-${++generatedId}`,
            name: item.name,
            position: 0,
            done: item.done,
            createdAt: updatedAt,
            updatedAt,
          })),
          createdAt: updatedAt,
          updatedAt,
        }));
        const updatedWorkstream = {
          ...ws,
          updatedAt,
          steps: [...pastSteps, ...echoedSteps],
        };

        overview = {
          ...overview,
          workstreams: overview.workstreams.map((item) =>
            item.id === ws.id ? updatedWorkstream : item,
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
          : problemResponse(404, problemDetails(404));
      },
    ),
  );

  return {
    getLastPipelineInput() {
      return lastPipelineInput;
    },

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
          problemResponse(status, problem),
        ),
      );
    },

    mockPipelineError(id: string, status: number, problem: ProblemOverrides) {
      server.use(
        http.put(`${API_BASE}/api/workstreams/${id}/pipeline`, () =>
          problemResponse(status, problemDetails(status, problem)),
        ),
      );
    },
  };
}

export function setupNotesApi(
  initialNotes: NoteEntry[],
  actor: NonNullable<NoteEntry['author']>,
) {
  let notes = initialNotes;
  let generatedId = 0;
  let shouldRejectNextUpdate = false;

  server.use(
    http.get(`${API_BASE}/api/workstreams/:id/notes`, () =>
      HttpResponse.json(notes),
    ),
    http.post(
      `${API_BASE}/api/steps/:stepId/notes`,
      async ({ params, request }) => {
        const input = (await request.json()) as CreateNoteInput;
        const timestamp = new Date(
          Date.UTC(2026, 6, 30, 12, 0, ++generatedId),
        ).toISOString();
        const created: NoteEntry = {
          id: `note-${generatedId}`,
          stepId: String(params.stepId),
          content: input.content,
          author: actor,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        notes = [created, ...notes];
        return HttpResponse.json(created, { status: 201 });
      },
    ),
    http.patch(`${API_BASE}/api/notes/:id`, async ({ params, request }) => {
      if (shouldRejectNextUpdate) {
        shouldRejectNextUpdate = false;
        return problemResponse(
          403,
          problemDetails(403, {
            type: 'https://wedding-planner.dev/errors/not-note-author',
            title: 'Forbidden',
            detail: 'Only the note author can change this note',
          }),
        );
      }

      const input = (await request.json()) as UpdateNoteInput;
      const existing = notes.find((note) => note.id === params.id);
      if (!existing) return problemResponse(404, problemDetails(404));
      const updated: NoteEntry = {
        ...existing,
        content: input.content,
        updatedAt: new Date(
          new Date(existing.updatedAt).getTime() + 1000,
        ).toISOString(),
      };
      notes = notes.map((note) => (note.id === updated.id ? updated : note));
      return HttpResponse.json(updated);
    }),
    http.delete(`${API_BASE}/api/notes/:id`, ({ params }) => {
      const hasNote = notes.some((note) => note.id === params.id);
      if (!hasNote) return problemResponse(404, problemDetails(404));
      notes = notes.filter((note) => note.id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),
  );

  return {
    getNotes: () => notes,
    rejectNextUpdate: () => {
      shouldRejectNextUpdate = true;
    },
  };
}
