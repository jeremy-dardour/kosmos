import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useUpdateProject } from '@/api/hooks/use-update-project';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import type { Project } from '@/api/hooks/use-overview';

interface ProjectSettingsDialogProperties {
  project: Project;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

/** Edits the project name and event date; an empty date clears the countdown. */
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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('overview.manage.project.title')}</DialogTitle>
        </DialogHeader>

        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
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

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              {t('overview.manage.form.cancel')}
            </DialogClose>
            <Button
              type="submit"
              size="sm"
              disabled={!isValid || updateProject.isPending}
            >
              {t(
                updateProject.isPending
                  ? 'overview.manage.form.saving'
                  : 'overview.manage.form.save',
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
