import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCreateGroup } from '@/api/hooks/use-create-group';
import { useDeleteGroup } from '@/api/hooks/use-delete-group';
import { useUpdateGroup } from '@/api/hooks/use-update-group';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogClose,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/features/overview/confirm-dialog';

import type { Group } from '@/api/hooks/use-overview';

const DEFAULT_COLOR = '#8b6cc1';

interface GroupManagerDialogProperties {
  projectId: string;
  groups: Group[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

interface GroupRowProperties {
  group: Group;
  onSave: (id: string, name: string, color: string) => void;
  onDelete: (group: Group) => void;
  isSaving: boolean;
}

const GroupRow = ({
  group,
  onSave,
  onDelete,
  isSaving,
}: GroupRowProperties) => {
  const { t } = useTranslation();
  const [name, setName] = useState(group.name);
  const [color, setColor] = useState(group.color);
  const isDirty = name.trim() !== group.name || color !== group.color;

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={t('overview.manage.groups.colorLabel', {
          name: group.name,
        })}
        value={color}
        className="size-8 shrink-0 cursor-pointer rounded-md border border-input bg-transparent"
        onChange={(event) => setColor(event.target.value)}
      />
      <Input
        aria-label={t('overview.manage.groups.nameLabel', { name: group.name })}
        value={name}
        maxLength={255}
        onChange={(event) => setName(event.target.value)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!isDirty || !name.trim() || isSaving}
        onClick={() => onSave(group.id, name.trim(), color)}
      >
        {t('overview.manage.groups.save')}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t('overview.manage.groups.deleteLabel', {
          name: group.name,
        })}
        onClick={() => onDelete(group)}
      >
        <Trash2Icon />
      </Button>
    </div>
  );
};

/** Lists groups with inline name/color edits, delete-with-confirm, and an add row. */
export const GroupManagerDialog = ({
  projectId,
  groups,
  isOpen,
  onOpenChange,
}: GroupManagerDialogProperties) => {
  const { t } = useTranslation();
  const createGroup = useCreateGroup(projectId);
  const updateGroup = useUpdateGroup(projectId);
  const deleteGroup = useDeleteGroup(projectId);

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_COLOR);
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);

  const addGroup = () => {
    if (!newName.trim() || createGroup.isPending) return;
    createGroup.mutate(
      {
        params: { path: { projectId } },
        body: { name: newName.trim(), color: newColor },
      },
      {
        onSuccess: () => {
          setNewName('');
          setNewColor(DEFAULT_COLOR);
        },
      },
    );
  };

  const saveGroup = (id: string, name: string, color: string) => {
    updateGroup.mutate({ params: { path: { id } }, body: { name, color } });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('overview.manage.groups.title')}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            {groups.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t('overview.manage.groups.empty')}
              </p>
            )}
            {groups.map((group) => (
              <GroupRow
                key={group.id}
                group={group}
                onSave={saveGroup}
                onDelete={setDeleteTarget}
                isSaving={updateGroup.isPending}
              />
            ))}
          </div>

          <form
            className="flex items-center gap-2 border-t pt-3"
            onSubmit={(event) => {
              event.preventDefault();
              addGroup();
            }}
          >
            <input
              type="color"
              aria-label={t('overview.manage.groups.newColorLabel')}
              value={newColor}
              className="size-8 shrink-0 cursor-pointer rounded-md border border-input bg-transparent"
              onChange={(event) => setNewColor(event.target.value)}
            />
            <Input
              aria-label={t('overview.manage.groups.newNameLabel')}
              value={newName}
              maxLength={255}
              placeholder={t('overview.manage.groups.newNamePlaceholder')}
              onChange={(event) => setNewName(event.target.value)}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!newName.trim() || createGroup.isPending}
            >
              <PlusIcon />
              {t('overview.manage.groups.add')}
            </Button>
          </form>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              {t('overview.manage.groups.done')}
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        title={t('overview.manage.groups.deleteTitle', {
          name: deleteTarget?.name ?? '',
        })}
        description={t('overview.manage.groups.deleteDescription')}
        confirmLabel={t('overview.manage.groups.deleteConfirm')}
        cancelLabel={t('overview.manage.form.cancel')}
        isPending={deleteGroup.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteGroup.mutate(
            { params: { path: { id: deleteTarget.id } } },
            { onSuccess: () => setDeleteTarget(null) },
          );
        }}
      />
    </>
  );
};
