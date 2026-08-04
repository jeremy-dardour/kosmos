import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { useCreateProject } from '@/api/hooks/use-create-project';
import { FormDialog } from '@/components/ui/form-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatToApiError } from '@/errors/format-error';

interface CreateProjectDialogProperties {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const CreateProjectDialog = ({
  isOpen,
  onOpenChange,
}: CreateProjectDialogProperties) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createProject = useCreateProject();

  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [limitReached, setLimitReached] = useState(false);

  const isValid = Boolean(name.trim());

  const submit = () => {
    if (!isValid || createProject.isPending) return;

    setLimitReached(false);
    createProject.mutate(
      { body: { name: name.trim(), eventDate: eventDate || null } },
      {
        onSuccess: (created) => {
          onOpenChange(false);
          void navigate(`/projects/${created.id}`);
        },
        onError: (error) => {
          const problemType = formatToApiError(error)?.problemType;
          if (problemType?.endsWith('/project-limit-reached')) {
            setLimitReached(true);
          }
        },
      },
    );
  };

  return (
    <FormDialog
      title={t('projects.create.title')}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      onSubmit={submit}
      isValid={isValid}
      isPending={createProject.isPending}
      submitLabel={t('projects.create.submit')}
      pendingLabel={t('projects.create.submitting')}
      cancelLabel={t('projects.create.cancel')}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-project-name">
          {t('projects.create.nameLabel')}
        </Label>
        <Input
          id="new-project-name"
          value={name}
          maxLength={255}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-project-event-date">
          {t('projects.create.eventDateLabel')}
        </Label>
        <Input
          id="new-project-event-date"
          type="date"
          value={eventDate}
          onChange={(event) => setEventDate(event.target.value)}
        />
      </div>

      {limitReached && (
        <p className="text-xs text-destructive">
          {t('projects.create.limitReached')}
        </p>
      )}
    </FormDialog>
  );
};
