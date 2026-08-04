import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { useProjects } from '@/api/hooks/use-projects';
import { useAuthState } from '@/auth';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { EventCountdown } from '@/features/overview/event-countdown';
import { CreateProjectDialog } from '@/features/projects/create-project-dialog';

export const ProjectListPage = () => {
  const { t } = useTranslation();
  const projects = useProjects();
  const authState = useAuthState();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

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

  return (
    <div className="mx-auto max-w-3xl">
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

      {isCreateOpen && (
        <CreateProjectDialog isOpen onOpenChange={setIsCreateOpen} />
      )}
    </div>
  );
};
