import { test as base } from '@playwright/test';

import type { Page } from '@playwright/test';

const IS_PLAYWRIGHT_USE_API_MOCK =
  process.env.PLAYWRIGHT_USE_API_MOCK === 'true';

interface ItemResponse {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiMock {
  getItems: (
    response: ItemResponse[],
    status?: number,
  ) => Promise<ItemResponse[]>;
}

export const test = base.extend<{ apiMock: ApiMock; page: Page }>({
  page: async ({ page: basePage }, use) => {
    const originalGetByText = basePage.getByText.bind(basePage);
    basePage.getByText = (text: string | RegExp) => {
      return originalGetByText(text, { exact: true });
    };
    await use(basePage);
  },
  apiMock: async ({ page }, use) => {
    const mocks: ApiMock = {
      getItems: async (response, status = 200) => {
        if (!IS_PLAYWRIGHT_USE_API_MOCK) return response;
        await page.route(/\/api\/items(\?.*)?$/, (route) =>
          route.fulfill({ status, json: response }),
        );
        return response;
      },
    };
    await use(mocks);
  },
});

export { expect } from '@playwright/test';
