import { test, expect } from '@playwright/test';

test.describe('Basic Tests', () => {
  test('should load login page', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page).toHaveTitle(/Tax Return Pro|TRP|Login/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('should load register page', async ({ page }) => {
    await page.goto('/auth/register');
    await expect(page).toHaveTitle(/Tax Return Pro|TRP|Register|Sign Up/);
    await expect(page.locator('input[name="email"]')).toBeVisible();

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/register-page.png', fullPage: true });
  });
});
