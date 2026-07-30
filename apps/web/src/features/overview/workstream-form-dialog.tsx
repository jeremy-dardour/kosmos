import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCreateWorkstream } from '@/api/hooks/use-create-workstream';
import { useUpdateWorkstream } from '@/api/hooks/use-update-workstream';
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

/**
 * One dialog for both creating and editing a workstream — the fields are
 * identical, so create/edit is an internal branch, not two components. State is
 * seeded from props; the parent remounts it per open with a `key` so each open
 * starts fresh.
 */
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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(
              mode === 'edit'
                ? 'overview.manage.form.editTitle'
                : 'overview.manage.form.createTitle',
            )}
          </DialogTitle>
        </DialogHeader>

        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
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

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              {t('overview.manage.form.cancel')}
            </DialogClose>
            <Button type="submit" size="sm" disabled={!isValid || isSaving}>
              {t(
                isSaving
                  ? 'overview.manage.form.saving'
                  : mode === 'edit'
                    ? 'overview.manage.form.save'
                    : 'overview.manage.form.create',
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
