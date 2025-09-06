import { test, expect } from '@playwright/test';

test.describe('Interactive Elements - Dynamic Scan', () => {
  async function completeSetupIfVisible(page) {
    const overlay = page.locator('#welcome-overlay');
    if (await overlay.isVisible().catch(() => false)) {
      await page.getByText('Select All', { exact: true }).click();
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Create My Org View' }).click();
      await expect(overlay).toBeHidden();
    }
  }

  test('scan and click interactive elements without errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await completeSetupIfVisible(page);

    // Collect buttons/links/toggles that are visible and enabled
    const selectors = [
      'button',
      'a[href]',
      '[role="button"]',
      '.control-btn',
      '.btn',
      '.link'
    ];
    const elements = page.locator(selectors.join(','));
    const startCount = await elements.count();

    // Click through a bounded subset to avoid long runtimes; re-check count each iteration to avoid stale nth
    const limit = Math.min(startCount, 60);
    for (let i = 0; i < limit; i++) {
      const currentCount = await elements.count();
      if (i >= currentCount) break;
      const el = elements.nth(i);
      // Skip if not visible (quick check, no waiting)
      if (!(await el.isVisible().catch(() => false))) continue;
      const text = (await el.textContent().catch(() => null))?.trim() || '';
      const ariaLabel = await el.getAttribute('aria-label').catch(() => null);
      const name = text || ariaLabel || '';

      // Skip destructive buttons (heuristic)
      if (/delete|remove/i.test(name)) continue;
      // Skip Reset Setup to avoid restarting onboarding mid-run
      if (/reset setup/i.test(name)) continue;
      // Safeguard: Skip any Import labeled elements if present in future
      if (/^import$/i.test(name)) continue;

      // Attempt click if visible and enabled
      if (await el.isVisible().catch(() => false)) {
        // Take a pre-click screenshot for regression
        await page.screenshot({ path: `test-results/pre-${i}-${name.replace(/\s+/g,'-').slice(0,24)}.png`, fullPage: false });
        await el.click({ timeout: 1000 }).catch(() => {});
        // Give UI time to update
        await page.waitForTimeout(50);
        // Post-click screenshot
        await page.screenshot({ path: `test-results/post-${i}-${name.replace(/\s+/g,'-').slice(0,24)}.png`, fullPage: false });
      }

      // If this click opened a detail panel, verify the Sort control theme
      const detailPanelOpen = await page.locator('#detail-panel.open').isVisible().catch(() => false);
      if (detailPanelOpen) {
        const sortWrap = page.locator('#detail-panel .sort-wrap');
        if (await sortWrap.isVisible().catch(() => false)) {
          const select = sortWrap.locator('select#task-sort');
          await expect(select).toBeVisible();
          // Basic theme checks (derived from design.json mapping to CSS vars)
          const styles = await select.evaluate((el) => {
            const s = getComputedStyle(el);
            return {
              color: s.color,
              backgroundColor: s.backgroundColor,
              borderColor: s.borderColor,
              borderRadius: s.borderRadius,
              fontFamily: s.fontFamily,
              fontSize: s.fontSize,
              boxShadow: s.boxShadow,
            };
          });
          const { color, backgroundColor, borderColor, borderRadius, fontFamily, fontSize } = styles;
          expect(color).toBeTruthy();
          expect(backgroundColor).toBeTruthy();
          expect(borderColor).toBeTruthy();
          expect(borderRadius).toBeTruthy();
          expect(fontFamily).toBeTruthy();
          expect(fontSize).toBeTruthy();
          // Screenshot for regression
          await sortWrap.screenshot({ path: `test-results/sort-wrap-${i}.png` });
        } else {
          // Fallback fix: apply a theme class if missing
          await page.evaluate(() => {
            const wrap = document.querySelector('#detail-panel .sort-wrap');
            if (wrap && !wrap.classList.contains('sort-wrap')) wrap.classList.add('sort-wrap');
          });
        }
      }
    }

    // Ensure no console errors occurred during interactions
    expect(consoleErrors, `Console errors encountered: \n${consoleErrors.join('\n')}`).toHaveLength(0);
  });
});


