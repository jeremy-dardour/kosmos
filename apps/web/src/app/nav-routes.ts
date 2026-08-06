import type { AgoRoute } from '@useago/sdk/react';

/**
 * Canonical absolute paths, used by both the router (`router.tsx`) and the
 * assistant's navigation (`NAVIGABLE_ROUTES`). Defined once here so a path
 * change can't leave the two out of sync — and kept out of `router.tsx` so
 * importing the manifest doesn't drag in the router instance and every page.
 */
export const paths = {
  projectList: '/',
  projectOverview: '/projects/:projectId',
} as const;

/**
 * The pages the assistant may navigate to. `description` is what the agent
 * reads to pick a page, so it is written for the agent, not the UI. `:projectId`
 * becomes a `projectId` argument the agent fills per project (ids come from the
 * `listProjects` function).
 */
export const NAVIGABLE_ROUTES: AgoRoute[] = [
  {
    name: 'projectList',
    path: paths.projectList,
    description:
      'The home page listing all projects the user belongs to. Start here to pick or create a project.',
  },
  {
    name: 'projectOverview',
    path: paths.projectOverview,
    description:
      'A single project’s overview: every workstream and its pipeline of steps, edited inline, with deadlines and filters. This is where actual project work happens.',
  },
];
