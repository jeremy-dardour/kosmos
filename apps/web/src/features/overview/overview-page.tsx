import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAdvanceWorkstream } from '@/api/hooks/use-advance-workstream';
import { useDeleteWorkstream } from '@/api/hooks/use-delete-workstream';
import { useOverview } from '@/api/hooks/use-overview';
import { useProjects } from '@/api/hooks/use-projects';
import { useAuthState } from '@/auth/auth-context';
import { ConfirmDialog } from '@/features/overview/confirm-dialog';
import { DetailPanel } from '@/features/overview/detail-panel';
import { OWNER_FILTER_ALL } from '@/features/overview/filter-constants';
import { GroupManagerDialog } from '@/features/overview/group-manager-dialog';
import { OverviewEditingPrototype } from '@/features/overview/overview-editing-prototype';
import { OverviewHeader } from '@/features/overview/overview-header';
import { OverviewSkeleton } from '@/features/overview/overview-skeleton';
import { ProjectSettingsDialog } from '@/features/overview/project-settings-dialog';
import { WidgetSidebarPrototype } from '@/features/overview/widget-panel-prototype';
import {
  PROTOTYPE_OPEN_STEP_EVENT,
  prototypeCardDomId,
} from '@/features/overview/widget-panel-prototype-shared';
import { WorkstreamCardList } from '@/features/overview/workstream-card-list';
import { WorkstreamFormDialog } from '@/features/overview/workstream-form-dialog';
import { cn } from '@/lib/utils';

import type { AdvanceOutcome } from '@/api/hooks/use-advance-workstream';
import type { UserSummary, Workstream } from '@/api/hooks/use-overview';
import type { DeadlineEntry } from '@/features/overview/widget-panel-prototype-shared';

type WorkstreamForm =
  | { mode: 'create' }
  | { mode: 'edit'; workstream: Workstream };

/**
 * PROTOTYPE seam — `?variant=A` swaps the overview body for the inline-editing
 * prototype and hides the detail panel. Read straight off the URL rather than
 * through the router, so the page keeps rendering outside a <Router>
 * (integration tests do that). Remove with the prototype.
 */
function isPrototypeRequested(): boolean {
  return new URLSearchParams(globalThis.location.search).get('variant') === 'A';
}

function applyOwnerFilter(
  workstreams: Workstream[],
  ownerId: string,
): Workstream[] {
  if (ownerId === OWNER_FILTER_ALL) return workstreams;

  return workstreams.filter((w) => {
    if (w.lifecycle === 'not_started' || w.lifecycle === 'complete') {
      return false;
    }
    const currentStep = w.steps.find((s) => s.status === 'in_progress');
    return currentStep?.effectiveOwnerId === ownerId;
  });
}

function applyGroupFilter(
  workstreams: Workstream[],
  hiddenGroupIds: ReadonlySet<string>,
): Workstream[] {
  if (hiddenGroupIds.size === 0) return workstreams;

  return workstreams.filter(
    (w) => !w.groupId || !hiddenGroupIds.has(w.groupId),
  );
}

export const OverviewPage = () => {
  const { t } = useTranslation();

  const projects = useProjects();
  const projectId = projects.data?.[0]?.id;
  const overview = useOverview(projectId);
  const advance = useAdvanceWorkstream(projectId);
  const deleteWorkstream = useDeleteWorkstream(projectId);
  const authState = useAuthState();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState(OWNER_FILTER_ALL);
  const [hiddenGroupIds, setHiddenGroupIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [workstreamForm, setWorkstreamForm] = useState<WorkstreamForm | null>(
    null,
  );
  const [groupManagerOpen, setGroupManagerOpen] = useState(false);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Workstream | null>(null);

  const currentUserId =
    authState.status === 'authenticated' ? authState.user.id : '';

  const usersById = useMemo(() => {
    if (!overview.data) return new Map<string, UserSummary>();
    return new Map(overview.data.users.map((u) => [u.id, u]));
  }, [overview.data]);

  const filteredWorkstreams = useMemo(() => {
    if (!overview.data) return [];
    const afterOwner = applyOwnerFilter(overview.data.workstreams, ownerFilter);
    return applyGroupFilter(afterOwner, hiddenGroupIds);
  }, [overview.data, ownerFilter, hiddenGroupIds]);

  const selectedWorkstream =
    overview.data?.workstreams.find((w) => w.id === selectedId) ?? null;

  if (selectedId && overview.data && !selectedWorkstream) {
    setSelectedId(null);
  }

  const isLoading =
    projects.isPending || (Boolean(projectId) && overview.isPending);
  const advancingId = advance.isPending
    ? advance.variables.params.path.id
    : null;

  const handleAdvance = (workstreamId: string, outcome?: AdvanceOutcome) => {
    advance.mutate({
      params: { path: { id: workstreamId } },
      body: outcome ? { outcome } : {},
    });
  };

  const handleGroupToggle = useCallback((groupId: string) => {
    setHiddenGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const isPrototype = isPrototypeRequested();

  // PROTOTYPE — describes the mirrored filters inside the widget panel.
  const filterNote = useMemo(() => {
    const parts: string[] = [];
    if (ownerFilter !== OWNER_FILTER_ALL) {
      parts.push(`owner ${usersById.get(ownerFilter)?.name ?? 'unknown'}`);
    }
    if (hiddenGroupIds.size > 0) {
      parts.push(
        `${hiddenGroupIds.size} group${hiddenGroupIds.size === 1 ? '' : 's'} hidden`,
      );
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }, [ownerFilter, usersById, hiddenGroupIds]);

  // PROTOTYPE — the navigation injected into the widgets: this page owns how a
  // deadline entry reaches its card; the widgets stay reusable elsewhere.
  const prototypeCrossLink = useMemo(
    () => ({
      onEntryClick: (entry: DeadlineEntry) => {
        document.dispatchEvent(
          new CustomEvent(PROTOTYPE_OPEN_STEP_EVENT, {
            detail: {
              workstreamId: entry.workstreamId,
              stepId: entry.stepId,
            },
          }),
        );
      },
      onEntryHover: (workstreamId: string | null) => {
        for (const element of document.querySelectorAll<HTMLElement>(
          '[data-proto-highlight]',
        )) {
          element.classList.remove('ring-2', 'ring-step-in-progress/50');
          delete element.dataset.protoHighlight;
        }
        if (!workstreamId) return;
        const card = document.querySelector<HTMLElement>(
          `#${prototypeCardDomId(workstreamId)}`,
        );
        card?.classList.add('ring-2', 'ring-step-in-progress/50');
        if (card) card.dataset.protoHighlight = '';
      },
    }),
    [],
  );

  return (
    <div
      className={cn(
        'grid h-full min-h-0 grid-cols-1 gap-4',
        !isPrototype && 'lg:grid-cols-[58fr_42fr]',
        isPrototype && 'grid-cols-[minmax(0,1fr)_auto]',
      )}
    >
      <div className="flex min-h-0 flex-col">
        {overview.data && (
          <OverviewHeader
            project={overview.data.project}
            users={overview.data.users}
            groups={overview.data.groups}
            currentUserId={currentUserId}
            ownerFilter={ownerFilter}
            onOwnerFilterChange={setOwnerFilter}
            hiddenGroupIds={hiddenGroupIds}
            onGroupToggle={handleGroupToggle}
            onNewWorkstream={() => setWorkstreamForm({ mode: 'create' })}
            onManageGroups={() => setGroupManagerOpen(true)}
            onProjectSettings={() => setProjectSettingsOpen(true)}
          />
        )}

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {isLoading && <OverviewSkeleton />}

          {!isLoading && !projectId && (
            <div className="rounded-lg border border-dashed p-panel text-center">
              <p className="text-sm font-medium">
                {t('overview.noProject.title')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('overview.noProject.description')}
              </p>
            </div>
          )}

          {overview.data && isPrototype && (
            <OverviewEditingPrototype
              groups={overview.data.groups}
              workstreams={filteredWorkstreams}
              users={overview.data.users}
            />
          )}

          {overview.data && !isPrototype && (
            <WorkstreamCardList
              groups={overview.data.groups}
              workstreams={filteredWorkstreams}
              usersById={usersById}
              selectedId={selectedId}
              onSelect={setSelectedId}
              advancingId={advancingId}
              onAdvance={handleAdvance}
            />
          )}
        </div>
      </div>

      {isPrototype && overview.data && (
        <WidgetSidebarPrototype
          workstreams={filteredWorkstreams}
          filterNote={filterNote}
          crossLink={prototypeCrossLink}
        />
      )}

      {!isPrototype && (
        <DetailPanel
          workstream={selectedWorkstream}
          projectId={projectId}
          users={overview.data?.users ?? []}
          usersById={usersById}
          onClose={() => setSelectedId(null)}
          onEdit={(workstream) =>
            setWorkstreamForm({ mode: 'edit', workstream })
          }
          onDelete={setDeleteTarget}
        />
      )}

      {overview.data && projectId && workstreamForm && (
        <WorkstreamFormDialog
          key={
            workstreamForm.mode === 'edit'
              ? workstreamForm.workstream.id
              : 'create'
          }
          mode={workstreamForm.mode}
          workstream={
            workstreamForm.mode === 'edit'
              ? workstreamForm.workstream
              : undefined
          }
          projectId={projectId}
          groups={overview.data.groups}
          users={overview.data.users}
          isOpen
          onOpenChange={(next) => !next && setWorkstreamForm(null)}
        />
      )}

      {overview.data && projectId && (
        <GroupManagerDialog
          projectId={projectId}
          groups={overview.data.groups}
          isOpen={groupManagerOpen}
          onOpenChange={setGroupManagerOpen}
        />
      )}

      {overview.data && projectSettingsOpen && (
        <ProjectSettingsDialog
          project={overview.data.project}
          isOpen={projectSettingsOpen}
          onOpenChange={setProjectSettingsOpen}
        />
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        title={t('overview.manage.deleteWorkstreamTitle', {
          name: deleteTarget?.name ?? '',
        })}
        description={t('overview.manage.deleteWorkstreamDescription')}
        confirmLabel={t('overview.manage.deleteWorkstreamConfirm')}
        cancelLabel={t('overview.manage.form.cancel')}
        isPending={deleteWorkstream.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteWorkstream.mutate(
            { params: { path: { id: deleteTarget.id } } },
            { onSuccess: () => setDeleteTarget(null) },
          );
        }}
      />
    </div>
  );
};
