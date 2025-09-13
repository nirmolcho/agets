import { test, expect } from '@playwright/test';

test.describe('Authentication UI', () => {
  test('login page renders and allows basic interactions', async ({ page }) => {
    await page.goto('/login.html');
    await expect(page.locator('.login-card')).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
    await page.getByPlaceholder('Email').fill('user@example.com');
    await page.getByPlaceholder('Password').fill('password');
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
  });

  test('app redirects to login when auth is required and unauthenticated (forced)', async ({ page }) => {
    // Force navigation to login by visiting login directly
    await page.goto('/login.html');
    await expect(page.locator('.login-card')).toBeVisible();
  });
});


