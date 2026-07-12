import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ApiError } from '@/api/errors';
import { GlobalApiErrorDialog } from '@/app/components/error/global-api-error-dialog';
import { ApiErrorProvider } from '@/errors/api-error-provider';
import { useApiError } from '@/errors/use-api-error';
import { createQueryWrapper } from '@/testing/test-utils';

const ErrorTrigger = ({ error }: { error: Error }) => {
  const { showError } = useApiError();
  return <button onClick={() => showError(error)}>Trigger Error</button>;
};

const renderWithProviders = (ui: React.ReactElement) => {
  const QueryWrapper = createQueryWrapper();
  return render(
    <QueryWrapper>
      <ApiErrorProvider>
        {ui}
        <GlobalApiErrorDialog />
      </ApiErrorProvider>
    </QueryWrapper>,
  );
};

describe('globalApiErrorDialog', () => {
  it('should not render dialog when there is no error', () => {
    renderWithProviders(<div>App content</div>);

    expect(screen.queryByText('Error')).not.toBeInTheDocument();
  });

  it('should render dialog when API error is shown', async () => {
    const user = userEvent.setup();
    const testError = new ApiError('Test error message', 500, 'Server Error');
    renderWithProviders(<ErrorTrigger error={testError} />);

    await user.click(screen.getByText('Trigger Error'));

    expect(screen.getByText('app.errorDialog.title')).toBeVisible();
  });

  it('should close dialog when close button is clicked', async () => {
    const user = userEvent.setup();
    const testError = new ApiError('Test error', 500, 'Server Error');

    renderWithProviders(<ErrorTrigger error={testError} />);

    await user.click(screen.getByText('Trigger Error'));
    expect(screen.getByText('app.errorDialog.title')).toBeVisible();

    const closeButton = screen.getByText('app.errorDialog.okButton');
    await user.click(closeButton);

    expect(screen.queryByText('app.errorDialog.title')).not.toBeInTheDocument();
  });

  it('should close dialog when Escape key is pressed', async () => {
    const user = userEvent.setup();
    const testError = new ApiError('Test error', 500, 'Server Error');

    renderWithProviders(<ErrorTrigger error={testError} />);

    await user.click(screen.getByText('Trigger Error'));

    await user.keyboard('{Escape}');

    expect(screen.queryByText('app.errorDialog.title')).not.toBeInTheDocument();
  });

  it('should not display dialog for non-API errors', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ErrorTrigger error={new Error('Generic error')} />);

    await user.click(screen.getByText('Trigger Error'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
