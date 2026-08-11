import { NAVIGABLE_ROUTES } from '@/app/nav-routes';
import { asFunctionParameters } from '@/assistant/functions/function-parameters';

import type { JsonSchema } from '@/assistant/functions/function-parameters';
import type { ClientFunctionDefinition } from '@useago/sdk';
import type { AgoRoute } from '@useago/sdk/react';

const PLACEHOLDER = /:(\w+)/g;

const placeholdersOf = (path: string): string[] =>
  path
    .split('/')
    .filter((segment) => segment.startsWith(':'))
    .map((segment) => segment.slice(1));

const routeLine = (route: AgoRoute): string => {
  const placeholders = placeholdersOf(route.path);
  const requires =
    placeholders.length > 0
      ? ` (requires ${placeholders.map((name) => `"${name}"`).join(', ')})`
      : '';

  return `- "${route.name}"${requires}: ${route.description}`;
};

const buildProperties = (routes: readonly AgoRoute[]) => {
  const routeNamesByPlaceholder = new Map<string, string[]>();
  for (const route of routes) {
    for (const placeholder of placeholdersOf(route.path)) {
      routeNamesByPlaceholder.set(placeholder, [
        ...(routeNamesByPlaceholder.get(placeholder) ?? []),
        route.name,
      ]);
    }
  }

  const properties: Record<string, JsonSchema> = {
    page: {
      type: 'string',
      description: `The page to navigate to: ${routes.map((route) => `"${route.name}"`).join(' or ')}.`,
    },
  };
  for (const [placeholder, routeNames] of routeNamesByPlaceholder) {
    properties[placeholder] = {
      type: 'string',
      description: `Value for ":${placeholder}" in the page path. Required when page is ${routeNames.map((name) => `"${name}"`).join(' or ')}.`,
    };
  }

  return properties;
};

const END_TURN_INSTRUCTION =
  'Navigating ends your turn: say you have moved the user to the page and stop there. The destination page registers its own capabilities on arrival, so they only become available on the user’s next message — never chain another call onto a navigation.';

const definition: Omit<ClientFunctionDefinition, 'handler'> = {
  name: 'navigateToPage',
  description: [
    'Navigate the user to a page in the application. Available pages:',
    NAVIGABLE_ROUTES.map((route) => routeLine(route)).join('\n'),
    END_TURN_INSTRUCTION,
  ].join('\n'),
  parameters: asFunctionParameters({
    type: 'object',
    properties: buildProperties(NAVIGABLE_ROUTES),
    required: ['page'],
  }),
};

export const navigateToPageFunction = (
  navigate: (path: string) => void,
): ClientFunctionDefinition => ({
  ...definition,
  handler: (arguments_) => {
    const page = arguments_.page;
    const route = NAVIGABLE_ROUTES.find((candidate) => candidate.name === page);
    if (!route) {
      return {
        success: false,
        error: `Unknown page: ${String(page)}. Pick one of ${NAVIGABLE_ROUTES.map((candidate) => `"${candidate.name}"`).join(', ')}.`,
      };
    }

    const missing: string[] = [];
    const path = route.path.replaceAll(PLACEHOLDER, (match, name: string) => {
      const value = arguments_[name];
      if (typeof value !== 'string' || value.length === 0) {
        missing.push(name);
        return match;
      }
      return value;
    });

    if (missing.length > 0) {
      return {
        success: false,
        error: `Page "${route.name}" needs ${missing.map((name) => `"${name}"`).join(', ')}. Retry with { "page": "${route.name}", ${missing.map((name) => `"${name}": "..."`).join(', ')} }.`,
      };
    }

    navigate(path);

    return {
      success: true,
      navigatedTo: path,
      page: route.name,
      next: END_TURN_INSTRUCTION,
    };
  },
});
