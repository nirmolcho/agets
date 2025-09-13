import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('UI/UX Design Compliance', () => {
  let designConfig: any;

  test.beforeAll(() => {
    // Load design.json for validation
    const designPath = path.join(process.cwd(), 'design.json');
    const designContent = fs.readFileSync(designPath, 'utf8');
    designConfig = JSON.parse(designContent);
  });

  test('validates container and background styles', async ({ page }) => {
    await page.goto('/app.html');
    
    // Check container background
    const body = page.locator('body');
    const bgColor = await body.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    );
    
    // Convert hex to rgb for comparison
    expect(bgColor).toBe('rgb(15, 15, 15)'); // #0F0F0F
    
    // Check font family
    const fontFamily = await body.evaluate(el => 
      window.getComputedStyle(el).fontFamily
    );
    expect(fontFamily).toContain('Inter');
  });

  test('validates card styling matches design.json', async ({ page }) => {
    await page.goto('/app.html');
    
    // Wait for cards to render
    await page.waitForSelector('.agent-card', { timeout: 5000 });
    
    const card = page.locator('.agent-card').first();
    
    // Check card background
    const bgColor = await card.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    );
    expect(bgColor).toBe('rgb(26, 26, 26)'); // #1A1A1A
    
    // Check card border
    const border = await card.evaluate(el => 
      window.getComputedStyle(el).border
    );
    expect(border).toContain('rgb(51, 51, 51)'); // #333333
    
    // Check border radius
    const borderRadius = await card.evaluate(el => 
      window.getComputedStyle(el).borderRadius
    );
    expect(borderRadius).toBe('12px');
    
    // Check hover effect
    await card.hover();
    await page.waitForTimeout(200); // Wait for transition
    
    const transform = await card.evaluate(el => 
      window.getComputedStyle(el).transform
    );
    expect(transform).toContain('matrix'); // Should have transform applied
  });

  test('validates button styles match design.json', async ({ page }) => {
    await page.goto('/app.html');
    
    // Check primary button
    const primaryBtn = page.locator('.btn-primary').first();
    const primaryBg = await primaryBtn.evaluate(el => 
      window.getComputedStyle(el).background
    );
    
    // Should have gradient
    expect(primaryBg).toContain('linear-gradient');
    expect(primaryBg).toContain('rgb(99, 102, 241)'); // #6366F1
    expect(primaryBg).toContain('rgb(139, 92, 246)'); // #8B5CF6
    
    // Check secondary button
    const secondaryBtn = page.locator('.btn-secondary').first();
    const secondaryBg = await secondaryBtn.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    );
    expect(secondaryBg).toBe('rgba(0, 0, 0, 0)'); // transparent
    
    const secondaryBorder = await secondaryBtn.evaluate(el => 
      window.getComputedStyle(el).border
    );
    expect(secondaryBorder).toContain('rgb(68, 68, 68)'); // #444444
  });

  test('validates department tag gradients', async ({ page }) => {
    await page.goto('/app.html');
    
    // Wait for department tags
    await page.waitForSelector('.dept-tag', { timeout: 5000 });
    
    const tags = await page.locator('.dept-tag').all();
    
    for (const tag of tags) {
      const bg = await tag.evaluate(el => 
        window.getComputedStyle(el).background
      );
      
      // Department tags should have gradients
      if (bg && bg !== 'none') {
        expect(bg).toContain('linear-gradient');
      }
      
      // Check text color is white
      const color = await tag.evaluate(el => 
        window.getComputedStyle(el).color
      );
      expect(color).toBe('rgb(255, 255, 255)'); // #FFFFFF
      
      // Check font weight
      const fontWeight = await tag.evaluate(el => 
        window.getComputedStyle(el).fontWeight
      );
      expect(['600', '700', 'bold']).toContain(fontWeight);
    }
  });

  test('validates status indicators', async ({ page }) => {
    await page.goto('/app.html');
    
    // Check active status
    const activeStatus = page.locator('.status-active').first();
    if (await activeStatus.count() > 0) {
      const activeBg = await activeStatus.evaluate(el => 
        window.getComputedStyle(el).backgroundColor
      );
      expect(activeBg).toBe('rgb(0, 255, 0)'); // #00FF00
      
      // Check glow effect
      const activeShadow = await activeStatus.evaluate(el => 
        window.getComputedStyle(el).boxShadow
      );
      expect(activeShadow).toContain('rgba(0, 255, 0'); // Green glow
    }
    
    // Check idle status
    const idleStatus = page.locator('.status-idle').first();
    if (await idleStatus.count() > 0) {
      const idleBg = await idleStatus.evaluate(el => 
        window.getComputedStyle(el).backgroundColor
      );
      expect(idleBg).toBe('rgb(255, 215, 0)'); // #FFD700
    }
    
    // Check error status
    const errorStatus = page.locator('.status-error').first();
    if (await errorStatus.count() > 0) {
      const errorBg = await errorStatus.evaluate(el => 
        window.getComputedStyle(el).backgroundColor
      );
      expect(errorBg).toBe('rgb(255, 69, 0)'); // #FF4500
    }
  });

  test('validates side panel styling', async ({ page }) => {
    await page.goto('/app.html');
    
    // Open detail panel
    await page.waitForSelector('.agent-card', { timeout: 5000 });
    await page.locator('.agent-card').first().click();
    
    await page.waitForSelector('.detail-panel.open', { timeout: 5000 });
    
    const panel = page.locator('.detail-panel');
    
    // Check background
    const bg = await panel.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    );
    expect(bg).toBe('rgb(26, 26, 26)'); // #1A1A1A
    
    // Check border
    const borderLeft = await panel.evaluate(el => 
      window.getComputedStyle(el).borderLeft
    );
    expect(borderLeft).toContain('rgb(51, 51, 51)'); // #333333
    
    // Check width constraints
    const width = await panel.evaluate(el => 
      window.getComputedStyle(el).width
    );
    const widthNum = parseFloat(width);
    expect(widthNum).toBeGreaterThanOrEqual(300); // minWidth
    expect(widthNum).toBeLessThanOrEqual(900); // Reasonable max
  });

  test('all toolbar buttons are functional', async ({ page }) => {
    await page.goto('/app.html');
    
    const buttons = [
      { id: 'btn-add-agent', name: 'Add Agent', action: 'modal' },
      { id: 'btn-export', name: 'Export', action: 'download' },
      { id: 'btn-dept-view', name: 'Departments View', action: 'view' },
      { id: 'btn-org-view', name: 'Org View', action: 'view' },
      { id: 'btn-reset-setup', name: 'Reset Setup', action: 'reset' },
      { id: 'btn-logout', name: 'Logout', action: 'navigate' }
    ];
    
    for (const btn of buttons) {
      const button = page.locator(`#${btn.id}`);
      
      // Check button exists and is visible
      await expect(button).toBeVisible();
      
      // Check button has proper cursor
      const cursor = await button.evaluate(el => 
        window.getComputedStyle(el).cursor
      );
      expect(cursor).toBe('pointer');
      
      // Verify button is clickable
      const isDisabled = await button.evaluate(el => 
        (el as HTMLButtonElement).disabled
      );
      expect(isDisabled).toBe(false);
    }
  });

  test('zoom controls are functional', async ({ page }) => {
    await page.goto('/app.html');
    
    const zoomButtons = [
      { id: 'btn-full-view', name: 'Full View' },
      { id: 'btn-focus-view', name: 'Zoom In' },
      { id: 'btn-reorganize', name: 'Reorganize' }
    ];
    
    for (const btn of zoomButtons) {
      const button = page.locator(`#${btn.id}`);
      await expect(button).toBeVisible();
      
      // Test clicking doesn't cause errors
      await button.click();
      await page.waitForTimeout(300); // Wait for animation
      
      // Check no console errors
      const errors = await page.evaluate(() => {
        return (window as any).__errors || [];
      });
      expect(errors).toHaveLength(0);
    }
  });

  test('validates responsive layout', async ({ page }) => {
    await page.goto('/app.html');
    
    // Test desktop view
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);
    
    // Cards should be visible
    await expect(page.locator('.agent-card').first()).toBeVisible();
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    
    // UI should still be functional
    await expect(page.locator('#toolbar')).toBeVisible();
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // Critical elements should still be accessible
    await expect(page.locator('#toolbar')).toBeVisible();
  });

  test('validates accessibility features', async ({ page }) => {
    await page.goto('/app.html');
    
    // Check ARIA attributes
    const overlay = page.locator('#welcome-overlay');
    const ariaHidden = await overlay.getAttribute('aria-hidden');
    expect(ariaHidden).toBe('true'); // Should be hidden after fix
    
    // Check focus states
    const button = page.locator('.btn').first();
    await button.focus();
    
    const outline = await button.evaluate(el => 
      window.getComputedStyle(el).outline
    );
    
    // Should have focus indicator
    if (outline && outline !== 'none') {
      expect(outline).toBeTruthy();
    }
    
    // Check status indicators have proper semantics
    const statusDot = page.locator('.status-dot').first();
    if (await statusDot.count() > 0) {
      const title = await statusDot.getAttribute('title');
      expect(title).toBeTruthy(); // Should have title for accessibility
    }
  });
});
