import { expect } from '@playwright/test';

import type { Page } from '@playwright/test';

export const expectInputValueByLabel = async (
  page: Page,
  label: string,
  value: string,
) => {
  await expect(page.locator(`input[labeltext="${label}"]`)).toHaveValue(value);
};
