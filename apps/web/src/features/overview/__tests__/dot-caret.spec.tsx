import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DotCaret } from '@/features/overview/dot-caret';

const STEP_IDS = ['step-1', 'step-2', 'step-3'];

function renderCaret(targetStepId: string, hasAppendColumn: boolean) {
  const { container } = render(
    <DotCaret
      stepIds={STEP_IDS}
      targetStepId={targetStepId}
      hasAppendColumn={hasAppendColumn}
    />,
  );

  const root = container.firstElementChild!;

  return {
    columns: [...root.children],
    tip: root.querySelector('span'),
  };
}

describe('dotCaret', () => {
  it('puts the caret in its own step column', () => {
    const { columns, tip } = renderCaret('step-2', true);

    expect(tip).not.toBeNull();
    expect(columns[1]).toContainElement(tip);
  });

  it('gives every step an equal-width column', () => {
    const { columns } = renderCaret('step-2', false);

    expect(columns).toHaveLength(STEP_IDS.length);
    for (const column of columns) expect(column).toHaveClass('flex-1');
  });

  it('mirrors the trailing add-step column when the row has one', () => {
    const { columns } = renderCaret('step-2', true);

    expect(columns).toHaveLength(STEP_IDS.length + 1);
    expect(columns.at(-1)).toHaveClass('w-8');
  });

  it('reserves no trailing column for a pipeline that cannot take steps', () => {
    const { columns } = renderCaret('step-3', false);

    expect(columns).toHaveLength(STEP_IDS.length);
    expect(columns.at(-1)).not.toHaveClass('w-8');
  });

  it('renders no caret when the target is not in the row', () => {
    const { tip } = renderCaret('step-gone', true);

    expect(tip).toBeNull();
  });
});
