import { test as base } from '@playwright/test';

import type { Page } from '@playwright/test';

export const test = base.extend<{ page: Page }>({
  page: async ({ page: basePage }, use) => {
    const originalGetByText = basePage.getByText.bind(basePage);
    basePage.getByText = (text: string | RegExp) => {
      return originalGetByText(text, { exact: true });
    };
    await use(basePage);
  },
});

export { expect } from '@playwright/test';
