import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FormDialog } from '@/components/ui/form-dialog';

function renderFormDialog(
  overrides: Partial<Parameters<typeof FormDialog>[0]> = {},
) {
  const props = {
    title: 'Edit thing',
    isOpen: true,
    onOpenChange: vi.fn(),
    onSubmit: vi.fn(),
    isValid: true,
    isPending: false,
    submitLabel: 'Save',
    pendingLabel: 'Saving…',
    cancelLabel: 'Cancel',
    ...overrides,
  };
  render(
    <FormDialog {...props}>
      <input aria-label="Field" />
    </FormDialog>,
  );
  return props;
}

describe('FormDialog', () => {
  it('renders the title, the fields, and the submit label', () => {
    renderFormDialog();
    expect(screen.getByRole('heading', { name: 'Edit thing' })).toBeVisible();
    expect(screen.getByLabelText('Field')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  it('shows the pending label and disables submit while pending', () => {
    renderFormDialog({ isPending: true });
    const submit = screen.getByRole('button', { name: 'Saving…' });
    expect(submit).toBeVisible();
    expect(submit).toBeDisabled();
  });

  it('disables submit when the form is invalid', () => {
    renderFormDialog({ isValid: false });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('calls onSubmit when the form is submitted', async () => {
    const agent = userEvent.setup();
    const { onSubmit } = renderFormDialog();
    await agent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('does not render its content when closed', () => {
    renderFormDialog({ isOpen: false });
    expect(screen.queryByRole('heading', { name: 'Edit thing' })).toBeNull();
  });
});
