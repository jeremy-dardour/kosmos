import { describe, it, expect } from 'vitest';

import { formatDate } from '../format-date';

describe('formatDate', () => {
  it('should format a Date object', () => {
    const result = formatDate(new Date('2024-01-15T00:00:00Z'), 'en-US');
    expect(result).toBe('Jan 15, 2024');
  });

  it('should format a date string', () => {
    const result = formatDate('2024-06-01T12:00:00Z', 'en-US');
    expect(result).toBe('Jun 1, 2024');
  });

  it('should support French locale', () => {
    const result = formatDate('2024-01-15T00:00:00Z', 'fr-FR');
    expect(result).toBe('15 janv. 2024');
  });
});
