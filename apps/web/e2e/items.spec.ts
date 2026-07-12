import { test, expect } from './fixtures';

const MOCK_ITEMS = [
  {
    id: '1',
    name: 'First Item',
    description: 'A description',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Second Item',
    description: null,
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  },
];

test.describe('Items page', () => {
  test('should display the items list', async ({ page, apiMock }) => {
    await apiMock.getItems(MOCK_ITEMS);
    await page.goto('/');

    await expect(page.getByText('Items')).toBeVisible();
    await expect(page.getByText('First Item')).toBeVisible();
    await expect(page.getByText('Second Item')).toBeVisible();
    await expect(page.getByText('A description')).toBeVisible();
  });

  test('should show empty state when no items', async ({ page, apiMock }) => {
    await apiMock.getItems([]);
    await page.goto('/');

    await expect(page.getByText('No items found.')).toBeVisible();
  });

  test('should open create dialog', async ({ page, apiMock }) => {
    await apiMock.getItems([]);
    await page.goto('/');

    await page.getByText('Create Item').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel('Name')).toBeVisible();
    await expect(page.getByLabel('Description')).toBeVisible();
  });
});
