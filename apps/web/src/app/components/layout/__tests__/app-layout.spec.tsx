import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppLayout } from '@/app/components/layout/app-layout';

const mockOutletTestId = 'outlet';
const mockHeaderTestId = 'layout-header';

const setup = () => {
  vi.mock('react-router', () => ({
    Outlet: () => <div data-testid={mockOutletTestId}></div>,
  }));
  vi.mock('@/app/components/layout/layout-header', () => ({
    LayoutHeader: () => <div data-testid={mockHeaderTestId}></div>,
  }));

  render(<AppLayout />);
};

describe('appLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it('should render the outlet', () => {
    const outlet = screen.getByTestId(mockOutletTestId);
    expect(outlet).toBeInTheDocument();
  });

  it('should render the header', () => {
    const header = screen.getByTestId(mockHeaderTestId);
    expect(header).toBeInTheDocument();
  });
});
