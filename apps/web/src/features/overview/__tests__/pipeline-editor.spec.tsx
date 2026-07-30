import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PipelineEditor } from '@/features/overview/pipeline-editor';
import { step, user, workstream } from '@/testing/mock-overview-data';
import { renderWithApp } from '@/testing/render-with-app';

import type { UpdateWorkstreamPipelineInput } from '@/api/hooks/use-update-workstream-pipeline';

const users = [user({ id: 'u1', name: 'Alice' })];
const noop = vi.fn();

function renderEditor(
  wsOverrides: Parameters<typeof workstream>[0] = {},
  props: {
    isSaving?: boolean;
    onSave?: (input: UpdateWorkstreamPipelineInput) => void;
  } = {},
) {
  const ws = workstream({
    id: 'w1',
    name: 'Catering',
    currentStepId: 's-current',
    steps: [
      step('Research', 'in_progress', { id: 's-current', position: 1 }),
      step('Quote', 'not_started', { id: 's-future', position: 2 }),
    ],
    ...wsOverrides,
  });
  const onSave = props.onSave ?? noop;
  const onCancel = vi.fn();

  renderWithApp(
    <PipelineEditor
      workstream={ws}
      users={users}
      isSaving={props.isSaving ?? false}
      onCancel={onCancel}
      onSave={onSave}
    />,
  );

  return { ws, onSave, onCancel };
}

describe('pipelineEditor — moveStep guards', () => {
  it('does not move the current step', () => {
    renderEditor();

    const moveDown = screen.getByRole('button', {
      name: 'Move Research down',
    });
    expect(moveDown).toBeDisabled();

    const moveUp = screen.getByRole('button', {
      name: 'Move Research up',
    });
    expect(moveUp).toBeDisabled();
  });

  it('prevents moving a step above the current step', () => {
    renderEditor();

    const moveUp = screen.getByRole('button', { name: 'Move Quote up' });
    expect(moveUp).toBeDisabled();
  });

  it('prevents moving the last step down', () => {
    renderEditor();

    const moveDown = screen.getByRole('button', { name: 'Move Quote down' });
    expect(moveDown).toBeDisabled();
  });

  it('allows reordering non-current future steps', async () => {
    const agent = userEvent.setup();
    renderEditor({
      steps: [
        step('Research', 'in_progress', { id: 's-current', position: 1 }),
        step('Quote', 'not_started', { id: 's-future-1', position: 2 }),
        step('Book', 'not_started', { id: 's-future-2', position: 3 }),
      ],
    });

    const moveDown = screen.getByRole('button', { name: 'Move Quote down' });
    expect(moveDown).toBeEnabled();
    await agent.click(moveDown);

    const editor = screen.getByRole('form', { name: 'Edit Catering pipeline' });
    const bookLabel = within(editor).getByText('Step 2');
    const quoteLabel = within(editor).getByText('Step 3');
    expect(
      bookLabel.compareDocumentPosition(quoteLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('allows reordering all steps in a not-started workstream', () => {
    renderEditor({
      lifecycle: 'not_started',
      currentStepId: null,
      steps: [
        step('First', 'not_started', { id: 's1', position: 1 }),
        step('Second', 'not_started', { id: 's2', position: 2 }),
      ],
    });

    const moveUp = screen.getByRole('button', { name: 'Move Second up' });
    expect(moveUp).toBeEnabled();
  });
});

describe('pipelineEditor — save payload', () => {
  it('trims step and checklist item names', async () => {
    const agent = userEvent.setup();
    const onSave = vi.fn();
    renderEditor(
      {
        lifecycle: 'not_started',
        currentStepId: null,
        steps: [step('Untrimmed', 'not_started', { id: 's1', position: 1 })],
      },
      { onSave },
    );

    const nameInput = screen.getByRole('textbox', { name: 'Step 1 name' });
    await agent.clear(nameInput);
    await agent.type(nameInput, '  Trimmed Name  ');

    await agent.click(screen.getByRole('button', { name: 'Save pipeline' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        steps: [expect.objectContaining({ name: 'Trimmed Name' })],
      }),
    );
  });

  it('converts empty deadline and owner to null', async () => {
    const onSave = vi.fn();
    renderEditor(
      {
        lifecycle: 'not_started',
        currentStepId: null,
        steps: [step('Task', 'not_started', { id: 's1', position: 1 })],
      },
      { onSave },
    );
    const agent = userEvent.setup();

    await agent.click(screen.getByRole('button', { name: 'Save pipeline' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        steps: [expect.objectContaining({ deadline: null, ownerId: null })],
      }),
    );
  });

  it('includes expectedUpdatedAt from the workstream', async () => {
    const onSave = vi.fn();
    renderEditor(
      {
        lifecycle: 'not_started',
        currentStepId: null,
        updatedAt: '2026-07-15T10:00:00.000Z',
        steps: [step('Task', 'not_started', { id: 's1', position: 1 })],
      },
      { onSave },
    );
    const agent = userEvent.setup();

    await agent.click(screen.getByRole('button', { name: 'Save pipeline' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedUpdatedAt: '2026-07-15T10:00:00.000Z',
      }),
    );
  });
});

describe('pipelineEditor — validation', () => {
  it('disables save when a step name is empty', async () => {
    const agent = userEvent.setup();
    renderEditor();

    const nameInput = screen.getByRole('textbox', { name: 'Step 2 name' });
    await agent.clear(nameInput);

    expect(
      screen.getByRole('button', { name: 'Save pipeline' }),
    ).toBeDisabled();
  });

  it('disables save when a checklist item name is empty', async () => {
    const agent = userEvent.setup();
    renderEditor();

    await agent.click(
      screen.getByRole('button', { name: 'Add checklist item to Quote' }),
    );

    expect(
      screen.getByRole('button', { name: 'Save pipeline' }),
    ).toBeDisabled();
  });

  it('does not call onSave via form submission when invalid', async () => {
    const agent = userEvent.setup();
    const onSave = vi.fn();
    renderEditor(undefined, { onSave });

    const nameInput = screen.getByRole('textbox', { name: 'Step 2 name' });
    await agent.clear(nameInput);

    await agent.click(screen.getByRole('button', { name: 'Save pipeline' }));

    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('pipelineEditor — current step constraints', () => {
  it('does not allow removing the current step', () => {
    renderEditor();

    expect(
      screen.getByRole('button', { name: 'Remove Research' }),
    ).toBeDisabled();
  });

  it('allows removing non-current steps', async () => {
    const agent = userEvent.setup();
    renderEditor();

    const remove = screen.getByRole('button', { name: 'Remove Quote' });
    expect(remove).toBeEnabled();
    await agent.click(remove);

    expect(screen.queryByText('Quote')).not.toBeInTheDocument();
  });
});
