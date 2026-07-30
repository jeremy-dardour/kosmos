import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useUpdateProject } from '@/api/hooks/use-update-project';
import { FormDialog } from '@/components/ui/form-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import type { Project } from '@/api/hooks/use-overview';

interface ProjectSettingsDialogProperties {
  project: Project;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const ProjectSettingsDialog = ({
  project,
  isOpen,
  onOpenChange,
}: ProjectSettingsDialogProperties) => {
  const { t } = useTranslation();
  const updateProject = useUpdateProject(project.id);

  const [name, setName] = useState(project.name);
  const [eventDate, setEventDate] = useState(project.eventDate ?? '');

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

  return (
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
    </FormDialog>
  );
};
