import { expect } from '@playwright/test';

import type { Page } from '@playwright/test';

export const expectDisabledInputByLabel = async (page: Page, label: string) => {
  await expect(page.locator(`input[labeltext="${label}"]`)).toBeDisabled();
};

export const expectEnabledInputByLabel = async (page: Page, label: string) => {
  await expect(page.locator(`input[labeltext="${label}"]`)).toBeEnabled();
};
