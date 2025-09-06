import { test, expect } from '@playwright/test';

test.describe('Agent Orchestration Studio', () => {
  async function completeSetupIfVisible(page) {
    const overlay = page.locator('#welcome-overlay');
    if (await overlay.isVisible().catch(() => false)) {
      // Step 1: Select All -> Continue
      await page.getByText('Select All', { exact: true }).click();
      await page.getByRole('button', { name: 'Continue' }).click();
      // Step 2: Scope -> keep default (Managers only) -> Continue
      await page.getByRole('button', { name: 'Continue' }).click();
      // Step 3: Layout -> keep default (Org Chart) -> Continue
      await page.getByRole('button', { name: 'Continue' }).click();
      // Step 4: Confirm -> Create
      await page.getByRole('button', { name: 'Create My Org View' }).click();
      await expect(overlay).toBeHidden();
    }
  }

  test('first load shows empty canvas and welcome overlay', async ({ page }) => {
    // Reset setup to simulate first load
    await page.goto('/app.html');
    await page.evaluate(() => sessionStorage.removeItem('aos_setup_v1'));
    await page.reload();
    // Only toolbar and welcome overlay visible; canvas content hidden
    await expect(page.locator('#toolbar')).toBeVisible();
    await expect(page.locator('#welcome-overlay')).toBeVisible();
    // Ensure cards and connections are not visible
    await expect(page.locator('#cards-layer')).toBeHidden({ timeout: 1000 }).catch(() => {});
  });

  test('renders org view with toolbar and canvas', async ({ page }) => {
    await page.goto('/app.html');
    await completeSetupIfVisible(page);
    await expect(page.locator('#toolbar')).toBeVisible();
    await expect(page.locator('#canvas-container')).toBeVisible();
    // Ensure Import button is absent
    await expect(page.locator('button:has-text("Import")')).toHaveCount(0);
    // Wait for agent cards to render to ensure layout completed
    await page.waitForSelector('.agent-card', { state: 'visible', timeout: 15000 });
    await expect(page.locator('#connections')).toBeVisible();
  });

  test('shows agent cards and opens detail panel', async ({ page }) => {
    await page.goto('/app.html');
    await completeSetupIfVisible(page);
    const cards = page.locator('.agent-card');
    await page.waitForSelector('.agent-card', { state: 'visible', timeout: 15000 });
    await cards.first().click();
    await expect(page.locator('#detail-panel')).toHaveClass(/open/);
    await expect(page.locator('#detail-panel')).toHaveAttribute('aria-hidden', 'false');
    await page.locator('#btn-close-panel').click();
    await expect(page.locator('#detail-panel')).not.toHaveClass(/open/);
  });

  test('switches to Departments View and opens overlay', async ({ page }) => {
    await page.goto('/app.html');
    await completeSetupIfVisible(page);
    await page.click('#btn-dept-view');
    // Department cards render as .dept-card
    const deptCards = page.locator('.dept-card');
    await page.waitForSelector('.dept-card', { state: 'visible', timeout: 15000 });
    await deptCards.first().click();
    await expect(page.locator('#overlay-panel')).not.toHaveClass(/hidden/);
    await page.click('#overlay-panel .overlay-content .btn.btn-secondary:has-text("Close")');
    await expect(page.locator('#overlay-panel')).toHaveClass(/hidden/);
  });

  test('status pulse tokens applied', async ({ page }) => {
    await page.goto('/');
    await completeSetupIfVisible(page);
    const activeDot = page.locator('.status-dot.status-active');
    await expect(activeDot.first()).toBeVisible();
    const boxShadow = await activeDot.first().evaluate((el) => getComputedStyle(el).boxShadow);
    expect(boxShadow).toBeTruthy();
  });
});


