import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import type { Step, UserSummary, Workstream } from '@/api/hooks/use-overview';
import type { UpdatePipelineInput } from '@/api/hooks/use-update-pipeline';

interface DraftChecklistItem {
  key: string;
  id?: string;
  name: string;
  done: boolean;
}

interface DraftStep {
  key: string;
  id?: string;
  name: string;
  deadline: string;
  ownerId: string;
  blocked: boolean;
  checklistItems: DraftChecklistItem[];
}

interface PipelineEditorProperties {
  workstream: Workstream;
  users: UserSummary[];
  isSaving: boolean;
  onCancel: () => void;
  onSave: (input: UpdatePipelineInput) => void;
}

function nextDraftKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function isPast(step: Step): boolean {
  return step.status === 'done' || step.status === 'skipped';
}

function toDraftStep(step: Step): DraftStep {
  return {
    key: step.id,
    id: step.id,
    name: step.name,
    deadline: step.deadline ?? '',
    ownerId: step.explicitOwnerId ?? '',
    blocked: step.blocked,
    checklistItems: step.checklistItems.map((item) => ({
      key: item.id,
      id: item.id,
      name: item.name,
      done: item.done,
    })),
  };
}

export const PipelineEditor = ({
  workstream,
  users,
  isSaving,
  onCancel,
  onSave,
}: PipelineEditorProperties) => {
  const { t } = useTranslation();
  const pastSteps = workstream.steps.filter((step) => isPast(step));
  const [draftSteps, setDraftSteps] = useState<DraftStep[]>(() =>
    workstream.steps
      .filter((step) => !isPast(step))
      .map((step) => toDraftStep(step)),
  );
  const currentStepId =
    workstream.lifecycle === 'active'
      ? (workstream.currentStepId ??
        workstream.steps.find((step) => step.status === 'in_progress')?.id ??
        null)
      : null;

  const updateStep = (index: number, update: Partial<DraftStep>) => {
    setDraftSteps((steps) =>
      steps.map((step, currentIndex) =>
        currentIndex === index ? { ...step, ...update } : step,
      ),
    );
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    setDraftSteps((steps) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= steps.length) return steps;
      if (
        steps[index]?.id === currentStepId ||
        (currentStepId != null && targetIndex === 0)
      ) {
        return steps;
      }
      const moved = [...steps];
      const [step] = moved.splice(index, 1);
      moved.splice(targetIndex, 0, step!);
      return moved;
    });
  };

  const updateChecklist = (
    stepIndex: number,
    checklistItems: DraftChecklistItem[],
  ) => updateStep(stepIndex, { checklistItems });

  const isValid = draftSteps.every(
    (step) =>
      step.name.trim() && step.checklistItems.every((item) => item.name.trim()),
  );

  const save = () => {
    if (!isValid) return;
    onSave({
      expectedUpdatedAt: workstream.updatedAt,
      steps: draftSteps.map((step) => ({
        ...(step.id && { id: step.id }),
        name: step.name.trim(),
        deadline: step.deadline || null,
        ownerId: step.ownerId || null,
        blocked: step.blocked,
        checklistItems: step.checklistItems.map((item) => ({
          ...(item.id && { id: item.id }),
          name: item.name.trim(),
          done: item.done,
        })),
      })),
    });
  };
  const saveLabel = t(
    isSaving ? 'overview.editor.saving' : 'overview.editor.save',
  );

  return (
    <form
      aria-label={t('overview.editor.formLabel', { name: workstream.name })}
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {pastSteps.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {t('overview.editor.pastHint')}
          </p>
        )}
        {pastSteps.map((step, index) => (
          <div
            key={step.id}
            className="rounded-md border bg-muted/35 p-3 opacity-60"
          >
            <Input
              aria-label={t('overview.editor.stepNameLabel', {
                position: index + 1,
              })}
              value={step.name}
              disabled
            />
          </div>
        ))}

        {/* TODO: extract step and checklist editing into sub-components (#39) */}
        {draftSteps.map((step, index) => {
          const position = pastSteps.length + index + 1;
          const isCurrent = step.id === currentStepId;
          const displayName =
            step.name.trim() || t('overview.editor.newStepName');

          return (
            <section
              key={step.key}
              aria-label={t('overview.editor.stepSectionLabel', { position })}
              className="space-y-2 rounded-md border bg-card p-3"
            >
              <div className="flex items-center gap-1">
                <span className="mr-auto text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {isCurrent
                    ? t('overview.detail.current')
                    : t('overview.editor.stepNumber', { position })}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t('overview.editor.moveStepUp', {
                    name: displayName,
                  })}
                  disabled={isCurrent || index <= (currentStepId ? 1 : 0)}
                  onClick={() => moveStep(index, -1)}
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t('overview.editor.moveStepDown', {
                    name: displayName,
                  })}
                  disabled={isCurrent || index === draftSteps.length - 1}
                  onClick={() => moveStep(index, 1)}
                >
                  <ArrowDownIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t('overview.editor.removeStep', {
                    name: displayName,
                  })}
                  disabled={isCurrent}
                  onClick={() =>
                    setDraftSteps((steps) =>
                      steps.filter((_, currentIndex) => currentIndex !== index),
                    )
                  }
                >
                  <Trash2Icon />
                </Button>
              </div>

              <Input
                aria-label={
                  step.id
                    ? t('overview.editor.stepNameLabel', { position })
                    : t('overview.editor.newStepName')
                }
                value={step.name}
                placeholder={t('overview.editor.stepNamePlaceholder')}
                onChange={(event) =>
                  updateStep(index, { name: event.target.value })
                }
              />

              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  aria-label={t('overview.editor.deadlineLabel', {
                    name: displayName,
                  })}
                  value={step.deadline}
                  onChange={(event) =>
                    updateStep(index, { deadline: event.target.value })
                  }
                />
                <select
                  aria-label={t('overview.editor.ownerLabel', {
                    name: displayName,
                  })}
                  value={step.ownerId}
                  onChange={(event) =>
                    updateStep(index, { ownerId: event.target.value })
                  }
                  className="h-8 min-w-0 rounded-lg border border-input bg-transparent px-2 text-xs"
                >
                  <option value="">{t('overview.editor.inheritOwner')}</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={step.blocked}
                  onChange={(event) =>
                    updateStep(index, { blocked: event.target.checked })
                  }
                />
                {t('overview.editor.blockedLabel')}
              </label>

              <div className="space-y-1.5 border-t pt-2">
                {step.checklistItems.map((item, itemIndex) => (
                  <div key={item.key} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      aria-label={t('overview.editor.itemDoneLabel', {
                        name:
                          item.name ||
                          t('overview.editor.newChecklistItemLabel'),
                      })}
                      checked={item.done}
                      onChange={(event) =>
                        updateChecklist(
                          index,
                          step.checklistItems.map(
                            (currentItem, currentIndex) =>
                              currentIndex === itemIndex
                                ? { ...currentItem, done: event.target.checked }
                                : currentItem,
                          ),
                        )
                      }
                      className="size-3.5 shrink-0"
                    />
                    <Input
                      aria-label={
                        item.id
                          ? t('overview.editor.checklistItemLabel', {
                              position: itemIndex + 1,
                              step: displayName,
                            })
                          : t('overview.editor.newChecklistItemLabel')
                      }
                      value={item.name}
                      placeholder={t(
                        'overview.editor.checklistItemPlaceholder',
                      )}
                      className="h-7 text-xs"
                      onChange={(event) =>
                        updateChecklist(
                          index,
                          step.checklistItems.map(
                            (currentItem, currentIndex) =>
                              currentIndex === itemIndex
                                ? { ...currentItem, name: event.target.value }
                                : currentItem,
                          ),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t('overview.editor.moveItemUp')}
                      disabled={itemIndex === 0}
                      onClick={() => {
                        const items = [...step.checklistItems];
                        const [moved] = items.splice(itemIndex, 1);
                        items.splice(itemIndex - 1, 0, moved!);
                        updateChecklist(index, items);
                      }}
                    >
                      <ArrowUpIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t('overview.editor.moveItemDown')}
                      disabled={itemIndex === step.checklistItems.length - 1}
                      onClick={() => {
                        const items = [...step.checklistItems];
                        const [moved] = items.splice(itemIndex, 1);
                        items.splice(itemIndex + 1, 0, moved!);
                        updateChecklist(index, items);
                      }}
                    >
                      <ArrowDownIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t('overview.editor.removeItem')}
                      onClick={() =>
                        updateChecklist(
                          index,
                          step.checklistItems.filter(
                            (_, currentIndex) => currentIndex !== itemIndex,
                          ),
                        )
                      }
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  aria-label={t('overview.editor.addItemTo', {
                    name: displayName,
                  })}
                  onClick={() =>
                    updateChecklist(index, [
                      ...step.checklistItems,
                      {
                        key: nextDraftKey('item'),
                        name: '',
                        done: false,
                      },
                    ])
                  }
                >
                  <PlusIcon />
                  {t('overview.editor.addChecklistItem')}
                </Button>
              </div>
            </section>
          );
        })}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() =>
            setDraftSteps((steps) => [
              ...steps,
              {
                key: nextDraftKey('step'),
                name: '',
                deadline: '',
                ownerId: '',
                blocked: false,
                checklistItems: [],
              },
            ])
          }
        >
          <PlusIcon />
          {t('overview.editor.addStep')}
        </Button>
      </div>

      <div className="flex justify-end gap-2 border-t px-4 py-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isSaving}
          onClick={onCancel}
        >
          {t('overview.editor.cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={!isValid || isSaving}>
          {saveLabel}
        </Button>
      </div>
    </form>
  );
};
