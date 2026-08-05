import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { useDeleteProject } from '@/api/hooks/use-delete-project';
import { useUpdateProject } from '@/api/hooks/use-update-project';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/features/overview/confirm-dialog';

import type { Project } from '@/api/hooks/use-overview';

interface ProjectSettingsDialogProperties {
  project: Project;
  currentUserId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const ProjectSettingsDialog = ({
  project,
  currentUserId,
  isOpen,
  onOpenChange,
}: ProjectSettingsDialogProperties) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const updateProject = useUpdateProject(project.id);
  const deleteProject = useDeleteProject();

  const [name, setName] = useState(project.name);
  const [eventDate, setEventDate] = useState(project.eventDate ?? '');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const isCurrentUserOwner = project.ownerId === currentUserId;
  const isValid = Boolean(name.trim());

  const submit = () => {
    if (!isValid || updateProject.isPending) return;
    updateProject.mutate(
      {
        params: { path: { id: project.id } },
        body: { name: name.trim(), eventDate: eventDate || null },
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const confirmDelete = () => {
    deleteProject.mutate(
      { params: { path: { id: project.id } } },
      {
        onSuccess: () => {
          setIsConfirmingDelete(false);
          onOpenChange(false);
          void navigate('/');
        },
      },
    );
  };

  return (
    <>
      <FormDialog
        title={t('overview.manage.project.title')}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        onSubmit={submit}
        isValid={isValid}
        isPending={updateProject.isPending}
        submitLabel={t('overview.manage.form.save')}
        pendingLabel={t('overview.manage.form.saving')}
        cancelLabel={t('overview.manage.form.cancel')}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-name">
            {t('overview.manage.project.nameLabel')}
          </Label>
          <Input
            id="project-name"
            value={name}
            maxLength={255}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-event-date">
            {t('overview.manage.project.eventDateLabel')}
          </Label>
          <Input
            id="project-event-date"
            type="date"
            value={eventDate}
            onChange={(event) => setEventDate(event.target.value)}
          />
        </div>

        {isCurrentUserOwner && (
          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <p className="text-xs text-muted-foreground">
              {t('overview.manage.project.deleteHint')}
            </p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setIsConfirmingDelete(true)}
            >
              {t('overview.manage.project.deleteAction')}
            </Button>
          </div>
        )}
      </FormDialog>

      <ConfirmDialog
        isOpen={isConfirmingDelete}
        onOpenChange={setIsConfirmingDelete}
        title={t('overview.manage.project.deleteTitle')}
        description={t('overview.manage.project.deleteDescription')}
        confirmLabel={t('overview.manage.project.deleteConfirm')}
        cancelLabel={t('overview.manage.form.cancel')}
        isPending={deleteProject.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
};
