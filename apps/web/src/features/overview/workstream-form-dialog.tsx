import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCreateWorkstream } from '@/api/hooks/use-create-workstream';
import { useUpdateWorkstream } from '@/api/hooks/use-update-workstream';
import { FormDialog } from '@/components/ui/form-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import type { Group, UserSummary, Workstream } from '@/api/hooks/use-overview';

interface WorkstreamFormDialogProperties {
  mode: 'create' | 'edit';
  workstream?: Workstream;
  projectId: string;
  groups: Group[];
  users: UserSummary[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const selectClass =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm';

/** One dialog for both creating and editing a workstream. */
export const WorkstreamFormDialog = ({
  mode,
  workstream,
  projectId,
  groups,
  users,
  isOpen,
  onOpenChange,
}: WorkstreamFormDialogProperties) => {
  const { t } = useTranslation();
  const createWorkstream = useCreateWorkstream(projectId);
  const updateWorkstream = useUpdateWorkstream(projectId);

  const [name, setName] = useState(workstream?.name ?? '');
  const [icon, setIcon] = useState(workstream?.icon ?? '');
  const [groupId, setGroupId] = useState(workstream?.groupId ?? '');
  const [ownerId, setOwnerId] = useState(workstream?.ownerId ?? '');

  const isSaving = createWorkstream.isPending || updateWorkstream.isPending;
  const isValid = Boolean(name.trim()) && Boolean(icon.trim());

  const close = () => onOpenChange(false);

  const submit = () => {
    if (!isValid || isSaving) return;
    const body = {
      name: name.trim(),
      icon: icon.trim(),
      groupId: groupId || null,
      ownerId: ownerId || null,
    };

    if (mode === 'edit' && workstream) {
      updateWorkstream.mutate(
        { params: { path: { id: workstream.id } }, body },
        { onSuccess: close },
      );
    } else {
      createWorkstream.mutate(
        { params: { path: { projectId } }, body },
        { onSuccess: close },
      );
    }
  };

  return (
    <FormDialog
      title={t(
        mode === 'edit'
          ? 'overview.manage.form.editTitle'
          : 'overview.manage.form.createTitle',
      )}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      onSubmit={submit}
      isValid={isValid}
      isPending={isSaving}
      submitLabel={t(
        mode === 'edit'
          ? 'overview.manage.form.save'
          : 'overview.manage.form.create',
      )}
      pendingLabel={t('overview.manage.form.saving')}
      cancelLabel={t('overview.manage.form.cancel')}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="workstream-name">
          {t('overview.manage.form.nameLabel')}
        </Label>
        <Input
          id="workstream-name"
          value={name}
          placeholder={t('overview.manage.form.namePlaceholder')}
          maxLength={255}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="workstream-icon">
          {t('overview.manage.form.iconLabel')}
        </Label>
        <Input
          id="workstream-icon"
          value={icon}
          placeholder={t('overview.manage.form.iconPlaceholder')}
          maxLength={255}
          className="w-20 text-center"
          onChange={(event) => setIcon(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="workstream-group">
          {t('overview.manage.form.groupLabel')}
        </Label>
        <select
          id="workstream-group"
          className={selectClass}
          value={groupId}
          onChange={(event) => setGroupId(event.target.value)}
        >
          <option value="">{t('overview.manage.form.noGroup')}</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="workstream-owner">
          {t('overview.manage.form.ownerLabel')}
        </Label>
        <select
          id="workstream-owner"
          className={selectClass}
          value={ownerId}
          onChange={(event) => setOwnerId(event.target.value)}
        >
          <option value="">{t('overview.manage.form.noOwner')}</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </div>
    </FormDialog>
  );
};
