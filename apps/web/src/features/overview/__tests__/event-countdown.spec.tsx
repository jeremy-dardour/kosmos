import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventCountdown } from '@/features/overview/event-countdown';

describe('eventCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 25, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when no event date is set', () => {
    const { container } = render(<EventCountdown eventDate={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('counts down to a future event', () => {
    render(<EventCountdown eventDate="2026-12-19" />);

    expect(screen.getByText('overview.header.eventInDays')).toBeInTheDocument();
  });

  it('says tomorrow the day before', () => {
    render(<EventCountdown eventDate="2026-07-26" />);

    expect(
      screen.getByText('overview.header.eventTomorrow'),
    ).toBeInTheDocument();
  });

  it('says today on the day', () => {
    render(<EventCountdown eventDate="2026-07-25" />);

    expect(screen.getByText('overview.header.eventToday')).toBeInTheDocument();
  });

  it('says yesterday the day after', () => {
    render(<EventCountdown eventDate="2026-07-24" />);

    expect(
      screen.getByText('overview.header.eventYesterday'),
    ).toBeInTheDocument();
  });

  it('counts up once the event has passed', () => {
    render(<EventCountdown eventDate="2026-07-22" />);

    expect(screen.getByText('overview.header.eventPassed')).toBeInTheDocument();
  });
});
