import { PlusIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { useAddMember } from '@/api/hooks/use-add-member';
import { useInvalidateOverview } from '@/api/hooks/use-invalidate-overview';
import {
  MEMBERS_NOT_FOUND_STATUS,
  useProjectMembers,
} from '@/api/hooks/use-project-members';
import { useRemoveMember } from '@/api/hooks/use-remove-member';
import { useTransferOwnership } from '@/api/hooks/use-transfer-ownership';
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
import { formatToApiError } from '@/errors/format-error';
import { ConfirmDialog } from '@/features/overview/confirm-dialog';
import { MemberRow } from '@/features/overview/members-dialog/member-row';

import type { Project } from '@/api/hooks/use-overview';
import type { Member } from '@/api/hooks/use-project-members';
import type {
  ActionKind,
  RowAction,
} from '@/features/overview/members-dialog/member-row';

interface MembersDialogProperties {
  project: Project;
  currentUserId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const CONFIRM_COPY = {
  remove: {
    title: 'overview.members.removeTitle',
    description: 'overview.members.removeDescription',
    confirm: 'overview.members.removeConfirm',
  },
  leave: {
    title: 'overview.members.leaveTitle',
    description: 'overview.members.leaveDescription',
    confirm: 'overview.members.leaveConfirm',
  },
  transfer: {
    title: 'overview.members.transferTitle',
    description: 'overview.members.transferDescription',
    confirm: 'overview.members.transferConfirm',
  },
} as const;

/**
 * Member list with pending/owner badges; the owner adds by email, removes
 * rows and hands over ownership, a non-owner member can leave via their own
 * row. Owner-gated controls are hidden — the API re-enforces regardless.
 */
export const MembersDialog = ({
  project,
  currentUserId,
  isOpen,
  onOpenChange,
}: MembersDialogProperties) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const members = useProjectMembers(project.id);
  const addMember = useAddMember(project.id);
  const removeMember = useRemoveMember(project.id);
  const transferOwnership = useTransferOwnership(project.id);
  const invalidateOverview = useInvalidateOverview(project.id);

  const [email, setEmail] = useState('');
  const [addError, setAddError] = useState<'duplicate' | 'limit' | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    kind: ActionKind;
    member: Member;
  } | null>(null);

  const isCurrentUserOwner = project.ownerId === currentUserId;
  const isMutating = removeMember.isPending || transferOwnership.isPending;

  // Access lost while the dialog was open (removed, or project deleted):
  // close and let the overview's own 404 state take over.
  const hasLostAccess =
    members.isError &&
    formatToApiError(members.error)?.status === MEMBERS_NOT_FOUND_STATUS;
  useEffect(() => {
    if (!hasLostAccess) return;
    onOpenChange(false);
    void invalidateOverview();
  }, [hasLostAccess, onOpenChange, invalidateOverview]);

  const rowActions = (member: Member): RowAction[] => {
    if (isCurrentUserOwner && !member.isOwner) {
      const displayName = member.name ?? member.email;
      const actions: RowAction[] = [];
      // Only joined members can take ownership; pending rows only get remove.
      if (member.userId) {
        actions.push({
          kind: 'transfer',
          label: t('overview.members.makeOwnerLabel', { name: displayName }),
          onSelect: () => setPendingAction({ kind: 'transfer', member }),
        });
      }
      actions.push({
        kind: 'remove',
        label: t('overview.members.removeLabel', { name: displayName }),
        onSelect: () => setPendingAction({ kind: 'remove', member }),
      });
      return actions;
    }
    if (!isCurrentUserOwner && member.userId === currentUserId) {
      return [
        {
          kind: 'leave',
          label: t('overview.members.leave'),
          onSelect: () => setPendingAction({ kind: 'leave', member }),
        },
      ];
    }
    return [];
  };

  const submitAdd = () => {
    if (!email.trim() || addMember.isPending) return;

    setAddError(null);
    addMember.mutate(
      {
        params: { path: { projectId: project.id } },
        body: { email: email.trim() },
      },
      {
        onSuccess: () => setEmail(''),
        onError: (error) => {
          const problemType = formatToApiError(error)?.problemType;
          if (problemType?.endsWith('/duplicate-member')) {
            setAddError('duplicate');
          } else if (problemType?.endsWith('/member-limit-reached')) {
            setAddError('limit');
          }
        },
      },
    );
  };

  const confirmPendingAction = () => {
    if (!pendingAction) return;
    const { kind, member } = pendingAction;

    if (kind === 'transfer') {
      transferOwnership.mutate(
        {
          params: { path: { id: project.id } },
          body: { memberId: member.id },
        },
        { onSuccess: () => setPendingAction(null) },
      );
      return;
    }

    removeMember.mutate(
      { params: { path: { projectId: project.id, memberId: member.id } } },
      {
        onSuccess: () => {
          setPendingAction(null);
          if (kind === 'leave') {
            onOpenChange(false);
            void navigate('/');
          }
        },
      },
    );
  };

  const confirmCopy = pendingAction ? CONFIRM_COPY[pendingAction.kind] : null;
  const confirmName =
    pendingAction?.member.name ?? pendingAction?.member.email ?? '';

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('overview.members.title')}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            {members.isPending && (
              <p className="text-sm text-muted-foreground">
                {t('overview.members.loading')}
              </p>
            )}
            {members.data?.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                actions={isMutating ? [] : rowActions(member)}
              />
            ))}
          </div>

          {isCurrentUserOwner && (
            <form
              className="flex items-center gap-2 border-t pt-3"
              onSubmit={(event) => {
                event.preventDefault();
                submitAdd();
              }}
            >
              <Input
                type="email"
                aria-label={t('overview.members.emailLabel')}
                value={email}
                maxLength={255}
                placeholder={t('overview.members.emailPlaceholder')}
                onChange={(event) => setEmail(event.target.value)}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!email.trim() || addMember.isPending}
              >
                <PlusIcon />
                {t('overview.members.add')}
              </Button>
            </form>
          )}

          {addError && (
            <p className="text-xs text-destructive">
              {t(
                addError === 'duplicate'
                  ? 'overview.members.duplicate'
                  : 'overview.members.limitReached',
              )}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              {t('overview.members.done')}
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmCopy && (
        <ConfirmDialog
          isOpen
          onOpenChange={(next) => !next && setPendingAction(null)}
          title={t(confirmCopy.title, { name: confirmName })}
          description={t(confirmCopy.description)}
          confirmLabel={t(confirmCopy.confirm)}
          cancelLabel={t('overview.manage.form.cancel')}
          isPending={isMutating}
          confirmVariant={
            pendingAction?.kind === 'transfer' ? 'default' : 'destructive'
          }
          onConfirm={confirmPendingAction}
        />
      )}
    </>
  );
};
