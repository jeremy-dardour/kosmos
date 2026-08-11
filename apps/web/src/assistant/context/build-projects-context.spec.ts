import { describe, expect, it } from 'vitest';

import { buildProjectsContext } from '@/assistant/context/build-projects-context';
import { project } from '@/testing/mock-overview-data';

import type { Project } from '@/api/hooks/use-overview';

const lines = (projects: Project[] | undefined): string[] =>
  String(buildProjectsContext(projects).data?.projects).split('\n');

describe('buildProjectsContext', () => {
  it('renders one id-led line per project', () => {
    expect(lines([project({ eventDate: '2027-09-12' })])).toEqual([
      'p1 Our Wedding · event 2027-09-12',
    ]);
  });

  it('says so explicitly when a project has no event date', () => {
    expect(lines([project({ eventDate: null })])).toEqual([
      'p1 Our Wedding · no event date',
    ]);
    expect(lines([project({ eventDate: undefined })])).toEqual([
      'p1 Our Wedding · no event date',
    ]);
  });

  it('excludes soft-deleted projects', () => {
    const listed = lines([
      project({ eventDate: '2027-09-12' }),
      project({
        id: 'p2',
        name: 'Old move',
        deletedAt: '2026-02-01T00:00:00.000Z',
      }),
    ]);

    expect(listed).toEqual(['p1 Our Wedding · event 2027-09-12']);
  });

  it('reports an empty list rather than an empty string', () => {
    expect(lines([])).toEqual(['no projects']);
    expect(lines(undefined)).toEqual(['no projects']);
  });
});
