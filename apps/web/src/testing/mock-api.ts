import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { STUB_USER } from '@/testing/stub-auth';

import type { AddMemberInput } from '@/api/hooks/use-add-member';
import type { CreateChecklistItemInput } from '@/api/hooks/use-create-checklist-item';
import type { CreateProjectInput } from '@/api/hooks/use-create-project';
import type { CreateStepInput } from '@/api/hooks/use-create-step';
import type {
  ChecklistItem,
  Group,
  Overview,
  Project,
  Step,
  Workstream,
} from '@/api/hooks/use-overview';
import type { Member } from '@/api/hooks/use-project-members';
import type { ReorderGroupsInput } from '@/api/hooks/use-reorder-groups';
import type { ReorderStepsInput } from '@/api/hooks/use-reorder-steps';
import type { ReorderWorkstreamsInput } from '@/api/hooks/use-reorder-workstreams';
import type { UpdateChecklistItemInput } from '@/api/hooks/use-update-checklist-item';
import type { UpdateStepInput } from '@/api/hooks/use-update-step';
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
    type: 'https://kosmos.dev/problems/not-found',
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

function notFound() {
  return problemResponse(404, problemDetails(404));
}

function conflict(slug: string, detail: string) {
  return problemResponse(
    409,
    problemDetails(409, {
      type: `https://kosmos.dev/errors/${slug}`,
      title: 'Conflict',
      detail,
    }),
  );
}

/** What `@IsNotEmpty()` on a name answers with (RFC 9457 through the filter). */
function emptyName() {
  return problemResponse(
    422,
    problemDetails(422, {
      type: 'https://kosmos.dev/errors/validation-failed',
      title: 'Validation Failed',
      detail: 'name: name should not be empty',
    }),
  );
}

function isExactMembership(ids: string[], members: string[]): boolean {
  return (
    ids.length === members.length &&
    new Set(ids).size === ids.length &&
    ids.every((id) => members.includes(id))
  );
}

function byPosition(left: { position: number }, right: { position: number }) {
  return left.position - right.position;
}

/** PATCH semantics: an absent field leaves the stored value alone, `null` clears it. */
function patched<T>(next: T | undefined, current: T): T {
  if (next === undefined) return current;

  return next;
}

function pointerPosition(workstream: Workstream) {
  return (
    workstream.steps.find((step) => step.id === workstream.currentStepId)
      ?.position ?? 0
  );
}

function futureSteps(workstream: Workstream) {
  const pointer = pointerPosition(workstream);

  return workstream.steps
    .filter((step) => step.position > pointer && step.outcome == null)
    .sort(byPosition);
}

interface AdvanceRequest {
  body: unknown;
  overview: Overview;
}

export function setupOverviewApi(initialOverview: Overview) {
  let overview = initialOverview;
  let generatedId = 0;
  let lastCreatedStep: CreateStepInput | null = null;
  let lastGroupOrder: ReorderGroupsInput | null = null;
  let lastWorkstreamOrder: ReorderWorkstreamsInput | null = null;
  let overviewFetches = 0;
  const deletedWorkstreamIds: string[] = [];

  function findWorkstream(id: string) {
    return overview.workstreams.find((workstream) => workstream.id === id);
  }

  function saveWorkstream(updated: Workstream) {
    overview = {
      ...overview,
      workstreams: overview.workstreams.map((workstream) =>
        workstream.id === updated.id ? updated : workstream,
      ),
    };
    return updated;
  }

  function saveSteps(workstream: Workstream, steps: Step[]) {
    return saveWorkstream({
      ...workstream,
      steps: [...steps].sort(byPosition),
      updatedAt: new Date().toISOString(),
    });
  }

  function locateStep(stepId: string) {
    for (const workstream of overview.workstreams) {
      const step = workstream.steps.find((item) => item.id === stepId);
      if (step) return { workstream, step };
    }
    return null;
  }

  function locateChecklistItem(itemId: string) {
    for (const workstream of overview.workstreams) {
      for (const step of workstream.steps) {
        const item = step.checklistItems.find((entry) => entry.id === itemId);
        if (item) return { workstream, step, item };
      }
    }
    return null;
  }

  server.use(
    http.post(
      `${API_BASE}/api/workstreams/:id/steps`,
      async ({ params, request }) => {
        const workstream = findWorkstream(String(params.id));
        if (!workstream) return notFound();

        const input = (await request.json()) as CreateStepInput;
        lastCreatedStep = input;
        if (input.name.trim() === '') return emptyName();
        if (
          workstream.lifecycle === 'complete' ||
          input.position <= pointerPosition(workstream) ||
          input.position > workstream.steps.length + 1
        ) {
          return conflict(
            'step-insertion-illegal',
            `Position ${input.position} is not in this workstream's future zone`,
          );
        }

        const now = new Date().toISOString();
        const created: Step = {
          id: `mock-step-${++generatedId}`,
          name: input.name,
          position: input.position,
          status: 'not_started',
          blocked: false,
          deadline: input.deadline ?? null,
          outcome: null,
          outcomeAt: null,
          explicitOwnerId: input.ownerId ?? null,
          effectiveOwnerId: input.ownerId ?? workstream.ownerId ?? null,
          checklistItems: [],
          noteCount: 0,
          createdAt: now,
          updatedAt: now,
        };

        return HttpResponse.json(
          saveSteps(workstream, [
            ...workstream.steps.map((step) =>
              step.position >= input.position
                ? { ...step, position: step.position + 1 }
                : step,
            ),
            created,
          ]),
          { status: 201 },
        );
      },
    ),
    http.patch(`${API_BASE}/api/steps/:id`, async ({ params, request }) => {
      const located = locateStep(String(params.id));
      if (!located) return notFound();
      if (located.step.outcome != null) {
        return conflict('step-frozen', 'Past steps cannot be edited');
      }

      const input = (await request.json()) as UpdateStepInput;
      if (input.name?.trim() === '') return emptyName();

      const { workstream, step } = located;
      const explicitOwnerId = patched(input.ownerId, step.explicitOwnerId);
      const updated: Step = {
        ...step,
        name: input.name ?? step.name,
        deadline: patched(input.deadline, step.deadline),
        blocked: input.blocked ?? step.blocked,
        explicitOwnerId,
        effectiveOwnerId: explicitOwnerId ?? workstream.ownerId ?? null,
        updatedAt: new Date().toISOString(),
      };

      saveSteps(
        workstream,
        workstream.steps.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      );
      return HttpResponse.json(updated);
    }),
    http.delete(`${API_BASE}/api/steps/:id`, ({ params }) => {
      const located = locateStep(String(params.id));
      if (!located) return notFound();

      const { workstream, step } = located;
      if (step.outcome != null) {
        return conflict('step-frozen', 'Past steps cannot be edited');
      }
      if (step.id === workstream.currentStepId) {
        return conflict(
          'step-not-deletable',
          'The current step cannot be deleted while it is in progress',
        );
      }

      return HttpResponse.json(
        saveSteps(
          workstream,
          workstream.steps
            .filter((item) => item.id !== step.id)
            .map((item) =>
              item.position > step.position
                ? { ...item, position: item.position - 1 }
                : item,
            ),
        ),
      );
    }),
    http.put(
      `${API_BASE}/api/workstreams/:id/step-order`,
      async ({ params, request }) => {
        const workstream = findWorkstream(String(params.id));
        if (!workstream) return notFound();

        const input = (await request.json()) as ReorderStepsInput;
        const future = futureSteps(workstream);
        if (
          !isExactMembership(
            input.ids,
            future.map((step) => step.id),
          )
        ) {
          return conflict(
            'order-mismatch',
            "The submitted ids do not match the workstream's future steps",
          );
        }

        const slots = future.map((step) => step.position);
        const byId = new Map(future.map((step) => [step.id, step]));
        const reordered = input.ids.map((id, index) => ({
          ...byId.get(id)!,
          position: slots[index]!,
        }));

        return HttpResponse.json(
          saveSteps(workstream, [
            ...workstream.steps.filter((step) => !byId.has(step.id)),
            ...reordered,
          ]),
        );
      },
    ),
    http.put(
      `${API_BASE}/api/projects/:projectId/group-order`,
      async ({ request }) => {
        const input = (await request.json()) as ReorderGroupsInput;
        lastGroupOrder = input;
        if (
          !isExactMembership(
            input.ids,
            overview.groups.map((group) => group.id),
          )
        ) {
          return conflict(
            'order-mismatch',
            "The submitted ids do not match the project's groups",
          );
        }

        const byId = new Map(overview.groups.map((group) => [group.id, group]));
        const ordered = input.ids.map((id, index) => ({
          ...byId.get(id)!,
          position: index,
        }));
        overview = { ...overview, groups: ordered };
        return HttpResponse.json(ordered);
      },
    ),
    http.put(
      `${API_BASE}/api/projects/:projectId/workstream-order`,
      async ({ request }) => {
        const input = (await request.json()) as ReorderWorkstreamsInput;
        lastWorkstreamOrder = input;
        const scope = overview.workstreams.filter(
          (workstream) =>
            (workstream.groupId ?? null) === (input.groupId ?? null),
        );
        const live = scope.filter(
          (workstream) => workstream.lifecycle !== 'complete',
        );
        if (
          !isExactMembership(
            input.ids,
            live.map((workstream) => workstream.id),
          )
        ) {
          return conflict(
            'order-mismatch',
            "The submitted ids do not match the scope's live workstreams",
          );
        }

        const byId = new Map(
          live.map((workstream) => [workstream.id, workstream]),
        );
        const ordered = input.ids.map((id, index) => ({
          ...byId.get(id)!,
          position: index,
        }));
        // Complete workstreams share the scope's position sequence and trail
        // the live ones, in their existing relative order.
        const trailing = scope
          .filter((workstream) => workstream.lifecycle === 'complete')
          .map((workstream, index) => ({
            ...workstream,
            position: ordered.length + index,
          }));
        const replacements = new Map(
          [...ordered, ...trailing].map((workstream) => [
            workstream.id,
            workstream,
          ]),
        );
        overview = {
          ...overview,
          workstreams: overview.workstreams.map(
            (workstream) => replacements.get(workstream.id) ?? workstream,
          ),
        };
        return HttpResponse.json(ordered);
      },
    ),
    http.post(
      `${API_BASE}/api/steps/:stepId/checklist-items`,
      async ({ params, request }) => {
        const located = locateStep(String(params.stepId));
        if (!located) return notFound();
        if (located.step.outcome != null) {
          return conflict('step-frozen', 'Past steps cannot be edited');
        }

        const input = (await request.json()) as CreateChecklistItemInput;
        const now = new Date().toISOString();
        const created: ChecklistItem = {
          id: `mock-item-${++generatedId}`,
          name: input.name,
          position:
            Math.max(
              0,
              ...located.step.checklistItems.map((item) => item.position),
            ) + 1,
          done: false,
          createdAt: now,
          updatedAt: now,
        };

        saveSteps(
          located.workstream,
          located.workstream.steps.map((step) =>
            step.id === located.step.id
              ? { ...step, checklistItems: [...step.checklistItems, created] }
              : step,
          ),
        );
        return HttpResponse.json(created, { status: 201 });
      },
    ),
    http.delete(`${API_BASE}/api/checklist-items/:id`, ({ params }) => {
      const located = locateChecklistItem(String(params.id));
      if (!located) return notFound();
      if (located.step.outcome != null) {
        return conflict('step-frozen', 'Past steps cannot be edited');
      }

      saveSteps(
        located.workstream,
        located.workstream.steps.map((step) =>
          step.id === located.step.id
            ? {
                ...step,
                checklistItems: step.checklistItems
                  .filter((item) => item.id !== located.item.id)
                  .map((item) =>
                    item.position > located.item.position
                      ? { ...item, position: item.position - 1 }
                      : item,
                  ),
              }
            : step,
        ),
      );
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(`${API_BASE}/api/projects`, () =>
      HttpResponse.json([overview.project]),
    ),
    http.get(`${API_BASE}/api/projects/:id/overview`, () => {
      overviewFetches += 1;
      return HttpResponse.json(overview);
    }),
    // The page fires the members query alongside the overview; by default the
    // fixture's users double as joined members. `setupMembersApi` (registered
    // later, so it wins) takes over when a test drives membership itself.
    http.get(`${API_BASE}/api/projects/:id/members`, () =>
      HttpResponse.json(
        overview.users.map(
          (user, index): Member => ({
            id: `member-row-${index}`,
            email: `${user.id}@example.com`,
            userId: user.id,
            name: user.name,
            avatarUrl: user.avatarUrl ?? null,
            isOwner: user.id === overview.project.ownerId,
            createdAt: overview.project.createdAt,
          }),
        ),
      ),
    ),
    http.get(`${API_BASE}/api/workstreams/:id/notes`, () =>
      HttpResponse.json([]),
    ),
    http.patch(
      `${API_BASE}/api/checklist-items/:id`,
      async ({ params, request }) => {
        const located = locateChecklistItem(String(params.id));
        if (!located) return notFound();
        if (located.step.outcome != null) {
          return conflict('step-frozen', 'Past steps cannot be edited');
        }

        const input = (await request.json()) as UpdateChecklistItemInput;
        const updated: ChecklistItem = {
          ...located.item,
          name: input.name ?? located.item.name,
          done: input.done ?? located.item.done,
          updatedAt: new Date().toISOString(),
        };

        saveSteps(
          located.workstream,
          located.workstream.steps.map((step) =>
            step.id === located.step.id
              ? {
                  ...step,
                  checklistItems: step.checklistItems.map((item) =>
                    item.id === updated.id ? updated : item,
                  ),
                }
              : step,
          ),
        );
        return HttpResponse.json(updated);
      },
    ),
    http.post(
      `${API_BASE}/api/projects/:projectId/workstreams`,
      async ({ request }) => {
        const input = (await request.json()) as {
          name: string;
          icon: string;
          groupId?: string | null;
          ownerId?: string | null;
        };
        const now = new Date().toISOString();
        const created: Workstream = {
          id: `mock-ws-${++generatedId}`,
          position: 0,
          name: input.name,
          icon: input.icon,
          groupId: input.groupId ?? null,
          lifecycle: 'not_started',
          ownerId: input.ownerId ?? null,
          currentStepId: null,
          startedAt: null,
          completedAt: null,
          nearestDeadlineStepId: null,
          steps: [],
          createdAt: now,
          updatedAt: now,
        };
        overview = {
          ...overview,
          workstreams: [
            created,
            ...overview.workstreams.map((item) =>
              (item.groupId ?? null) === created.groupId
                ? { ...item, position: item.position + 1 }
                : item,
            ),
          ],
        };
        return HttpResponse.json(created, { status: 201 });
      },
    ),
    http.patch(
      `${API_BASE}/api/workstreams/:id`,
      async ({ params, request }) => {
        const input = (await request.json()) as Partial<Workstream>;
        const ws = overview.workstreams.find((item) => item.id === params.id);
        if (!ws) return problemResponse(404, problemDetails(404));

        const updated = {
          ...ws,
          ...input,
          updatedAt: new Date().toISOString(),
        };
        overview = {
          ...overview,
          workstreams: overview.workstreams.map((item) =>
            item.id === ws.id ? updated : item,
          ),
        };
        return HttpResponse.json(updated);
      },
    ),
    http.delete(`${API_BASE}/api/workstreams/:id`, ({ params }) => {
      deletedWorkstreamIds.push(String(params.id));
      overview = {
        ...overview,
        workstreams: overview.workstreams.filter(
          (item) => item.id !== params.id,
        ),
      };
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(
      `${API_BASE}/api/projects/:projectId/groups`,
      async ({ request }) => {
        const input = (await request.json()) as {
          name: string;
          color: string;
        };
        const now = new Date().toISOString();
        const created: Group = {
          id: `mock-group-${++generatedId}`,
          position: overview.groups.length,
          name: input.name,
          color: input.color,
          createdAt: now,
          updatedAt: now,
        };
        overview = { ...overview, groups: [...overview.groups, created] };
        return HttpResponse.json(created, { status: 201 });
      },
    ),
    http.patch(`${API_BASE}/api/groups/:id`, async ({ params, request }) => {
      const input = (await request.json()) as Partial<Group>;
      const existing = overview.groups.find((item) => item.id === params.id);
      if (!existing) return problemResponse(404, problemDetails(404));

      const updated = {
        ...existing,
        ...input,
        updatedAt: new Date().toISOString(),
      };
      overview = {
        ...overview,
        groups: overview.groups.map((item) =>
          item.id === existing.id ? updated : item,
        ),
      };
      return HttpResponse.json(updated);
    }),
    http.delete(`${API_BASE}/api/groups/:id`, ({ params }) => {
      overview = {
        ...overview,
        groups: overview.groups.filter((item) => item.id !== params.id),
        workstreams: overview.workstreams.map((item) =>
          item.groupId === params.id ? { ...item, groupId: null } : item,
        ),
      };
      return new HttpResponse(null, { status: 204 });
    }),
    http.patch(`${API_BASE}/api/projects/:id`, async ({ request }) => {
      const input = (await request.json()) as Partial<Project>;
      overview = {
        ...overview,
        project: {
          ...overview.project,
          ...input,
          updatedAt: new Date().toISOString(),
        },
      };
      return HttpResponse.json(overview.project);
    }),
  );

  return {
    /** The body of the last create-step call, rejected ones included. */
    getLastCreatedStep() {
      return lastCreatedStep;
    },

    getLastGroupOrder() {
      return lastGroupOrder;
    },

    getLastWorkstreamOrder() {
      return lastWorkstreamOrder;
    },

    /** How many times the aggregate has been read — a refetch is observable. */
    getOverviewFetches() {
      return overviewFetches;
    },

    getDeletedWorkstreamIds() {
      return deletedWorkstreamIds;
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
  };
}

/** GET/POST `/api/projects`, standing in for `setupOverviewApi`'s single-project GET when a test drives the list itself. */
export function setupProjectsApi(initialProjects: Project[] = []) {
  let projects = initialProjects;
  let generatedId = 0;
  let nextCreateError: {
    status: number;
    problem: Record<string, unknown>;
  } | null = null;

  server.use(
    http.get(`${API_BASE}/api/projects`, () => HttpResponse.json(projects)),
    http.post(`${API_BASE}/api/projects`, async ({ request }) => {
      if (nextCreateError) {
        const { status, problem } = nextCreateError;
        nextCreateError = null;
        return problemResponse(status, problem);
      }

      const input = (await request.json()) as CreateProjectInput;
      const now = new Date().toISOString();
      const created: Project = {
        id: `mock-project-${++generatedId}`,
        name: input.name,
        eventDate: input.eventDate ?? null,
        ownerId: STUB_USER.id,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      projects = [...projects, created];
      return HttpResponse.json(created, { status: 201 });
    }),
  );

  return {
    getProjects: () => projects,
    mockCreateProjectError(status: number, problem: Record<string, unknown>) {
      nextCreateError = { status, problem };
    },
  };
}

export function setupMembersApi(initialMembers: Member[], projectId = 'p1') {
  let members = initialMembers;
  let generatedId = 0;
  let isListGone = false;
  let nextAddError: {
    status: number;
    problem: Record<string, unknown>;
  } | null = null;

  server.use(
    http.get(`${API_BASE}/api/projects/${projectId}/members`, () =>
      isListGone ? notFound() : HttpResponse.json(members),
    ),
    http.post(
      `${API_BASE}/api/projects/${projectId}/members`,
      async ({ request }) => {
        if (nextAddError) {
          const { status, problem } = nextAddError;
          nextAddError = null;
          return problemResponse(status, problem);
        }

        const input = (await request.json()) as AddMemberInput;
        const created: Member = {
          id: `mock-member-${++generatedId}`,
          email: input.email.toLowerCase(),
          userId: null,
          name: null,
          avatarUrl: null,
          isOwner: false,
          createdAt: new Date().toISOString(),
        };
        members = [...members, created];
        return HttpResponse.json(created, { status: 201 });
      },
    ),
    http.delete(
      `${API_BASE}/api/projects/${projectId}/members/:memberId`,
      ({ params }) => {
        members = members.filter((member) => member.id !== params.memberId);
        return new HttpResponse(null, { status: 204 });
      },
    ),
  );

  return {
    getMembers: () => members,
    mockAddMemberError(status: number, problem: Record<string, unknown>) {
      nextAddError = { status, problem };
    },
    /** Subsequent list fetches 404 — access lost while the dialog is open. */
    mockMembersGone() {
      isListGone = true;
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
            type: 'https://kosmos.dev/errors/not-note-author',
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
