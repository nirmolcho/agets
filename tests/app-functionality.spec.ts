import { test, expect } from '@playwright/test';

test.describe('App Core Functionality', () => {
  test('app loads and all main features work', async ({ page }) => {
    // Navigate to the app
    await page.goto('/app.html');
    
    // Verify the app loads without the welcome overlay blocking
    await expect(page.locator('#welcome-overlay')).toHaveClass(/hidden/);
    await expect(page.locator('#toolbar')).toBeVisible();
    
    // Verify we can see agent cards (the app is rendering)
    await page.waitForSelector('.agent-card', { timeout: 5000 });
    const agentCards = await page.locator('.agent-card').count();
    expect(agentCards).toBeGreaterThan(0);
    
    // Test Org View button
    await page.getByRole('button', { name: 'Org View' }).click();
    await expect(page.locator('.agent-card').first()).toBeVisible();
    
    // Test Departments View button
    await page.getByRole('button', { name: 'Departments View' }).click();
    await page.waitForSelector('.dept-card', { timeout: 5000 });
    await expect(page.locator('.dept-card').first()).toBeVisible();
    
    // Test Add Agent button opens modal
    await page.getByRole('button', { name: 'Add Agent' }).click();
    await expect(page.locator('#action-modal')).toHaveClass(/open/);
    await page.getByRole('button', { name: 'Cancel' }).click();
    
    // Test Export button (should trigger download)
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('agent-configuration');
    
    // Test zoom controls
    await page.getByRole('button', { name: 'Full View' }).click();
    await page.waitForTimeout(300);
    
    await page.getByRole('button', { name: 'Zoom In' }).click();
    await page.waitForTimeout(300);
    
    await page.getByRole('button', { name: 'Reorganize' }).click();
    await page.waitForTimeout(300);
    
    // Verify no console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    
    // Give it a moment to see if any errors appear
    await page.waitForTimeout(1000);
    expect(consoleErrors).toHaveLength(0);
    
    // Test clicking on an agent card opens detail panel
    await page.getByRole('button', { name: 'Org View' }).click();
    await page.locator('.agent-card').first().click();
    await expect(page.locator('.detail-panel')).toHaveClass(/open/);
    
    // Verify department tags have gradients (check inline styles)
    const deptTags = await page.locator('.dept-tag').all();
    if (deptTags.length > 0) {
      const firstTag = deptTags[0];
      const style = await firstTag.getAttribute('style');
      // Department tags should have inline styles with gradients
      if (style) {
        expect(style.toLowerCase()).toContain('gradient');
      }
    }
    
    // Verify status indicators are present and have proper classes
    const statusDots = await page.locator('.status-dot').all();
    expect(statusDots.length).toBeGreaterThan(0);
    
    for (const dot of statusDots.slice(0, 3)) { // Check first 3
      const className = await dot.getAttribute('class');
      expect(className).toMatch(/status-(active|idle|error)/);
    }
  });

  test('app handles Reset Setup correctly', async ({ page }) => {
    await page.goto('/app.html');
    
    // Click Reset Setup
    await page.getByRole('button', { name: 'Reset Setup' }).click();
    
    // Verify the overlay doesn't appear (stays hidden)
    await expect(page.locator('#welcome-overlay')).toHaveClass(/hidden/);
    
    // Verify the canvas is still visible
    await expect(page.locator('#canvas-container')).toBeVisible();
    
    // Verify we still have cards rendered
    await page.waitForSelector('.agent-card', { timeout: 5000 });
    const cards = await page.locator('.agent-card').count();
    expect(cards).toBeGreaterThan(0);
  });
});
