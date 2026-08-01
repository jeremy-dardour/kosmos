import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PipelineRow } from '@/features/overview/pipeline-row';
import {
  checklistItem as buildChecklistItem,
  step as buildStep,
} from '@/testing/mock-overview-data';

import type {
  ChecklistItem,
  Step,
  StepStatus,
  UserSummary,
  WorkstreamLifecycle,
} from '@/api/hooks/use-overview';

const NOW = new Date(2026, 7, 1);

const USERS = new Map<string, UserSummary>([
  ['user-1', { id: 'user-1', name: 'Ada Lovelace', avatarUrl: null }],
]);

/** Shared builders, but with `id: name` so assertions can use bare names. */
function step(
  name: string,
  status: StepStatus,
  overrides: Partial<Step> = {},
): Step {
  return buildStep(name, status, { id: name, ...overrides });
}

function item(name: string, isDone: boolean): ChecklistItem {
  return buildChecklistItem(name, isDone, { id: name });
}

interface RowOverrides {
  steps?: Step[];
  currentStepId?: string | null;
  lifecycle?: WorkstreamLifecycle;
  openStepId?: string | null;
  openNotesStepId?: string | null;
  onStepToggle?: (stepId: string) => void;
  onNoteMarkerToggle?: (stepId: string) => void;
  onInsertStep?: (position: number) => void;
  onChecklistItemToggle?: (itemId: string, isDone: boolean) => void;
}

function renderRow({
  steps = [],
  currentStepId = null,
  lifecycle = 'active',
  openStepId = null,
  openNotesStepId = null,
  onStepToggle = vi.fn(),
  onNoteMarkerToggle = vi.fn(),
  onInsertStep = vi.fn(),
  onChecklistItemToggle = vi.fn(),
}: RowOverrides = {}) {
  render(
    <PipelineRow
      steps={steps}
      currentStepId={currentStepId}
      lifecycle={lifecycle}
      usersById={USERS}
      now={NOW}
      openStepId={openStepId}
      openNotesStepId={openNotesStepId}
      onStepToggle={onStepToggle}
      onNoteMarkerToggle={onNoteMarkerToggle}
      onInsertStep={onInsertStep}
      onChecklistItemToggle={onChecklistItemToggle}
    />,
  );
}

/** The dot button of a step, from which its whole column can be reached. */
function stepButton(name: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(name) });
}

function column(name: string): HTMLElement {
  return stepButton(name).closest('li')!;
}

function dotFor(name: string, statusKey: string): HTMLElement {
  return screen.getByTitle(`${name} — overview.stepStatus.${statusKey}`);
}

function insertPoints(): HTMLElement[] {
  return screen.queryAllByRole('button', {
    name: 'overview.pipeline.insertStepBefore',
  });
}

function appendPoint(): HTMLElement | null {
  return screen.queryByRole('button', { name: 'overview.pipeline.appendStep' });
}

/** Renders a lone future step with a deadline and returns its ringed dot. */
function ringOf(deadline: string): HTMLElement {
  renderRow({ steps: [step('Book', 'not_started', { deadline })] });

  return screen.getByTitle(/overview\.pipeline\.dueTooltip/);
}

describe('pipelineRow', () => {
  describe('statuses', () => {
    it('colours each dot by status', () => {
      renderRow({
        steps: [
          step('Shortlist', 'done'),
          step('Compare', 'skipped'),
          step('Visit', 'in_progress'),
          step('Book', 'not_started'),
        ],
        currentStepId: 'Visit',
      });

      expect(dotFor('Shortlist', 'done')).toHaveClass('bg-step-done');
      expect(dotFor('Compare', 'skipped')).toHaveClass('border-step-skipped');
      expect(dotFor('Visit', 'inProgress')).toHaveClass('bg-step-in-progress');
      expect(dotFor('Book', 'notStarted')).toHaveClass(
        'border-step-not-started',
      );
    });

    it('sizes the current step and any blocked step larger than the rest', () => {
      renderRow({
        steps: [
          step('Shortlist', 'done'),
          step('Visit', 'in_progress', { blocked: true }),
        ],
        currentStepId: 'Visit',
      });

      expect(dotFor('Shortlist', 'done')).toHaveClass('size-3.5');
      expect(dotFor('Visit', 'blocked')).toHaveClass('size-5');
    });

    it('lets a blocked current step override its status colour', () => {
      renderRow({
        steps: [step('Addresses', 'in_progress', { blocked: true })],
        currentStepId: 'Addresses',
      });

      const dot = dotFor('Addresses', 'blocked');
      expect(dot).toHaveClass('bg-step-blocked');
      expect(dot).toHaveClass('shadow-step-blocked');
    });

    it('ignores a stale blocked flag on a step that has been passed', () => {
      renderRow({ steps: [step('Addresses', 'done', { blocked: true })] });

      expect(dotFor('Addresses', 'done')).toHaveClass('bg-step-done');
    });

    it('dims settled steps that are not open', () => {
      renderRow({
        steps: [step('Shortlist', 'done'), step('Visit', 'in_progress')],
        currentStepId: 'Visit',
      });

      expect(stepButton('Shortlist')).toHaveClass('opacity-55');
      expect(stepButton('Visit')).not.toHaveClass('opacity-55');
    });

    it('names an unnamed step with the placeholder', () => {
      renderRow({ steps: [step('', 'not_started')] });

      expect(
        screen.getByText('overview.pipeline.untitled'),
      ).toBeInTheDocument();
    });

    it('marks the open step pressed and toggles through the callback', async () => {
      const onStepToggle = vi.fn();
      renderRow({
        steps: [step('Shortlist', 'done'), step('Visit', 'in_progress')],
        currentStepId: 'Visit',
        openStepId: 'Visit',
        onStepToggle,
      });

      expect(stepButton('Visit')).toHaveAttribute('aria-pressed', 'true');
      expect(stepButton('Shortlist')).toHaveAttribute('aria-pressed', 'false');

      await userEvent.click(stepButton('Shortlist'));
      expect(onStepToggle).toHaveBeenCalledWith('Shortlist');
    });
  });

  describe('deadline signals', () => {
    it('rings an overdue step thickest, in the late colour', () => {
      const dot = ringOf('2026-07-20');

      expect(dot).toHaveClass('ring-[3px]');
      expect(dot).toHaveClass('text-urgency-passed');
    });

    it('rings a step due within the week in the soon colour', () => {
      const dot = ringOf('2026-08-05');

      expect(dot).toHaveClass('ring-2');
      expect(dot).toHaveClass('text-urgency-week-foreground');
    });

    it('rings a step due within the fortnight in orange', () => {
      expect(ringOf('2026-08-10')).toHaveClass(
        'text-urgency-fortnight-foreground',
      );
    });

    it('rings a step due within the month in yellow', () => {
      expect(ringOf('2026-08-20')).toHaveClass('text-urgency-month-foreground');
    });

    it('rings a far-off step in muted grey', () => {
      expect(ringOf('2026-12-20')).toHaveClass('text-muted-foreground/60');
    });

    it('leaves a settled step its date but no ring', () => {
      renderRow({
        steps: [step('Shortlist', 'done', { deadline: '2026-07-20' })],
      });

      expect(dotFor('Shortlist', 'done')).not.toHaveClass('ring-[3px]');
      expect(within(column('Shortlist')).getByText(/20/)).toHaveClass(
        'text-muted-foreground/60',
      );
    });

    it('rings nothing in a complete pipeline but still shows the dates', () => {
      renderRow({
        steps: [step('Book', 'done', { deadline: '2026-07-20' })],
        lifecycle: 'complete',
      });

      expect(
        screen.queryByTitle(/overview\.pipeline\.dueTooltip/),
      ).not.toBeInTheDocument();
      expect(within(column('Book')).getByText(/20/)).toBeInTheDocument();
    });
  });

  describe('note markers', () => {
    it('shows no marker on a step without notes', () => {
      renderRow({ steps: [step('Book', 'not_started')] });

      expect(
        screen.queryByRole('button', { name: /overview\.notes\./ }),
      ).not.toBeInTheDocument();
    });

    it('shows the count on every step that has notes, including passed ones', () => {
      renderRow({
        steps: [
          step('Shortlist', 'done', { noteCount: 3 }),
          step('Visit', 'in_progress'),
        ],
        currentStepId: 'Visit',
      });

      const marker = within(column('Shortlist')).getByRole('button', {
        name: 'overview.notes.showForStep',
      });
      expect(marker).toHaveTextContent('3');
      expect(marker).toHaveAttribute('aria-pressed', 'false');
      expect(marker).toHaveAttribute('title', 'overview.notes.showForStep');
      expect(
        within(column('Visit')).queryByRole('button', {
          name: /overview\.notes\./,
        }),
      ).not.toBeInTheDocument();
    });

    it('inverts the marker whose panel is open and toggles through the callback', async () => {
      const onNoteMarkerToggle = vi.fn();
      renderRow({
        steps: [step('Shortlist', 'done', { noteCount: 1 })],
        openNotesStepId: 'Shortlist',
        onNoteMarkerToggle,
      });

      const marker = within(column('Shortlist')).getByRole('button', {
        name: 'overview.notes.hideForStep',
      });
      expect(marker).toHaveAttribute('aria-pressed', 'true');
      expect(marker).toHaveClass('bg-foreground');

      await userEvent.click(marker);
      expect(onNoteMarkerToggle).toHaveBeenCalledWith('Shortlist');
    });
  });

  describe('owner override', () => {
    it('shows an avatar only when the step overrides the workstream owner', () => {
      renderRow({
        steps: [
          step('Shortlist', 'done', {
            explicitOwnerId: 'user-1',
            effectiveOwnerId: 'user-1',
          }),
          step('Visit', 'in_progress', { effectiveOwnerId: 'user-1' }),
        ],
        currentStepId: 'Visit',
      });

      expect(
        within(column('Shortlist')).getByRole('img', { name: 'Ada Lovelace' }),
      ).toBeInTheDocument();
      expect(
        within(column('Visit')).queryByRole('img'),
      ).not.toBeInTheDocument();
    });
  });

  describe('step insertion', () => {
    const STEPS = [
      step('Shortlist', 'not_started'),
      step('Visit', 'not_started'),
      step('Book', 'not_started'),
    ];

    it('offers every position of a not-started pipeline', () => {
      renderRow({
        steps: STEPS,
        currentStepId: null,
        lifecycle: 'not_started',
      });

      expect(insertPoints()).toHaveLength(STEPS.length);
      expect(appendPoint()).toBeInTheDocument();
    });

    it('offers only the positions after the current step', () => {
      renderRow({
        steps: [
          step('Shortlist', 'done'),
          step('Visit', 'in_progress'),
          step('Book', 'not_started'),
        ],
        currentStepId: 'Visit',
      });

      expect(insertPoints()).toHaveLength(1);
      expect(appendPoint()).toBeInTheDocument();
    });

    it('offers nothing in a complete pipeline', () => {
      renderRow({
        steps: [step('Shortlist', 'done'), step('Book', 'done')],
        lifecycle: 'complete',
      });

      expect(insertPoints()).toHaveLength(0);
      expect(appendPoint()).not.toBeInTheDocument();
    });

    it('reports the 1-indexed position it would insert at', async () => {
      const onInsertStep = vi.fn();
      renderRow({
        steps: STEPS,
        currentStepId: null,
        lifecycle: 'not_started',
        onInsertStep,
      });

      await userEvent.click(insertPoints()[1]!);
      expect(onInsertStep).toHaveBeenCalledWith(2);

      await userEvent.click(appendPoint()!);
      expect(onInsertStep).toHaveBeenCalledWith(STEPS.length + 1);
    });

    it('keeps the insertion points out of the column layout', () => {
      renderRow({
        steps: STEPS,
        currentStepId: null,
        lifecycle: 'not_started',
      });

      expect(insertPoints()[0]!.closest('li')).toHaveClass('w-0');
    });
  });

  describe('checklist preview', () => {
    const CURRENT = step('Visit', 'in_progress', {
      checklistItems: [
        item('Chateau A', true),
        item('Chateau B', false),
        item('Chateau C', false),
        item('Chateau D', false),
      ],
    });
    const NEXT = step('Book', 'not_started', {
      checklistItems: [item('Deposit', false)],
    });

    it('previews the current and next steps only', () => {
      renderRow({
        steps: [
          step('Shortlist', 'done', { checklistItems: [item('Ask', false)] }),
          CURRENT,
          NEXT,
          step('Sign', 'not_started', {
            checklistItems: [item('Print', false)],
          }),
        ],
        currentStepId: 'Visit',
      });

      expect(screen.queryByText('Ask')).not.toBeInTheDocument();
      expect(screen.getByText('Chateau B')).toBeInTheDocument();
      expect(screen.getByText('Deposit')).toBeInTheDocument();
      expect(screen.queryByText('Print')).not.toBeInTheDocument();
    });

    it('hides the preview while that step is open', () => {
      renderRow({
        steps: [CURRENT, NEXT],
        currentStepId: 'Visit',
        openStepId: 'Visit',
      });

      expect(screen.queryByText('Chateau B')).not.toBeInTheDocument();
      expect(screen.getByText('Deposit')).toBeInTheDocument();
    });

    it('shows the unfinished items first and counts the rest', () => {
      renderRow({ steps: [CURRENT], currentStepId: 'Visit' });

      const previewed = within(column('Visit'))
        .getAllByRole('button', { name: 'overview.pipeline.toggleItem' })
        .map((button) => button.textContent);

      expect(previewed).toEqual(['Chateau B', 'Chateau C', 'Chateau D']);
      expect(
        screen.getByText('overview.pipeline.moreItems'),
      ).toBeInTheDocument();
    });

    it('ticks a current step item in place', async () => {
      const onChecklistItemToggle = vi.fn();
      renderRow({
        steps: [CURRENT],
        currentStepId: 'Visit',
        onChecklistItemToggle,
      });

      await userEvent.click(screen.getByText('Chateau B'));
      expect(onChecklistItemToggle).toHaveBeenCalledWith('Chateau B', true);
    });

    it('leaves the next step preview read-only', () => {
      renderRow({ steps: [CURRENT, NEXT], currentStepId: 'Visit' });

      expect(
        within(column('Book')).getByRole('button', {
          name: 'overview.pipeline.toggleItem',
        }),
      ).toBeDisabled();
    });
  });
});
