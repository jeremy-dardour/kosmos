import { ChevronDownIcon, ChevronRightIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { useProjects } from '@/api/hooks/use-projects';
import { useRestoreProject } from '@/api/hooks/use-restore-project';
import { AssistantScope } from '@/assistant/assistant-scope';
import { ProjectListAssistantContext } from '@/assistant/project-list-assistant-context';
import { useAuthState } from '@/auth';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { formatToApiError } from '@/errors/format-error';
import { EventCountdown } from '@/features/overview/event-countdown';
import { CreateProjectDialog } from '@/features/projects/create-project-dialog';

export const ProjectListPage = () => {
  const { t, i18n } = useTranslation();
  const projects = useProjects();
  const authState = useAuthState();
  const restoreProject = useRestoreProject();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeletedOpen, setIsDeletedOpen] = useState(false);
  const [restoreErrorId, setRestoreErrorId] = useState<string | null>(null);

  if (projects.isPending) {
    return (
      <div role="status" aria-label={t('projects.list.loading')}>
        {t('projects.list.loading')}
      </div>
    );
  }

  const currentUserId =
    authState.status === 'authenticated' ? authState.user.id : null;
  const items = (projects.data ?? []).filter((project) => !project.deletedAt);
  // The API only returns the current user's own deleted projects.
  const deletedItems = (projects.data ?? []).filter(
    (project) => project.deletedAt,
  );

  const restore = (projectId: string) => {
    if (restoreProject.isPending) return;
    setRestoreErrorId(null);
    restoreProject.mutate(
      { params: { path: { id: projectId } } },
      {
        onError: (error) => {
          const problemType = formatToApiError(error)?.problemType;
          if (problemType?.endsWith('/project-limit-reached')) {
            setRestoreErrorId(projectId);
          }
        },
      },
    );
  };

  const DeletedChevron = isDeletedOpen ? ChevronDownIcon : ChevronRightIcon;

  return (
    <div className="mx-auto max-w-3xl">
      <AssistantScope>
        <ProjectListAssistantContext />
      </AssistantScope>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t('projects.list.title')}</h1>
        <Button type="button" size="sm" onClick={() => setIsCreateOpen(true)}>
          <PlusIcon />
          {t('projects.list.newProject')}
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-panel text-center">
          <p className="text-sm font-medium">
            {t('projects.list.empty.title')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('projects.list.empty.description')}
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-3"
            onClick={() => setIsCreateOpen(true)}
          >
            {t('projects.list.empty.action')}
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`}>
              <Card className="transition-colors hover:bg-muted/40">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{project.name}</span>
                      {project.ownerId === currentUserId && (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {t('projects.list.ownerBadge')}
                        </span>
                      )}
                    </span>
                    <EventCountdown eventDate={project.eventDate} />
                  </CardTitle>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {deletedItems.length > 0 && (
        <div className="mt-8">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={isDeletedOpen}
            onClick={() => setIsDeletedOpen((previous) => !previous)}
          >
            <DeletedChevron />
            {t('projects.deleted.title', { total: deletedItems.length })}
          </Button>

          {isDeletedOpen && (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {deletedItems.map((project) => (
                <Card key={project.id} className="bg-muted/30">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate">{project.name}</span>
                        <span className="block text-xs font-normal text-muted-foreground">
                          {t('projects.deleted.deletedOn', {
                            date: new Date(
                              project.deletedAt!,
                            ).toLocaleDateString(i18n.language),
                          })}
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={restoreProject.isPending}
                        onClick={() => restore(project.id)}
                      >
                        {t('projects.deleted.restore')}
                      </Button>
                    </CardTitle>
                    {restoreErrorId === project.id && (
                      <p className="mt-1 text-xs text-destructive">
                        {t('projects.deleted.limitReached')}
                      </p>
                    )}
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {isCreateOpen && (
        <CreateProjectDialog isOpen onOpenChange={setIsCreateOpen} />
      )}
    </div>
  );
};
