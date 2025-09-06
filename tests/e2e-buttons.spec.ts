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

    await page.goto('/app.html');

    // Explicitly validate key toolbar buttons first
    await page.getByRole('button', { name: 'Org View' }).click();
    await page.getByRole('button', { name: 'Departments View' }).click();
    await expect(page.locator('.dept-card').first()).toBeVisible();
    await page.getByRole('button', { name: 'Org View' }).click();
    await expect(page.locator('.agent-card').first()).toBeVisible();

    // Add Agent flow via modal
    await page.getByRole('button', { name: 'Add Agent' }).click();
    await page.locator('#action-modal').waitFor({ state: 'visible' }).catch(() => {});
    // Fill modal fields if rendered
    const hasDept = await page.locator('#modal-dept').count();
    if (hasDept) {
      const opt = await page.locator('#modal-dept option').first().getAttribute('value');
      if (opt) await page.selectOption('#modal-dept', opt);
      await page.fill('#modal-name', 'QA Bot');
      await page.fill('#modal-role', 'qa-bot');
      await page.getByRole('button', { name: 'Confirm' }).click();
    }

    // Verify new agent exists or at least cards are present
    await page.waitForTimeout(200);
    const anyCards = await page.locator('.agent-card').count();
    expect(anyCards).toBeGreaterThan(0);

    // Existing dynamic scan
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

    const limit = Math.min(startCount, 60);
    for (let i = 0; i < limit; i++) {
      const currentCount = await elements.count();
      if (i >= currentCount) break;
      const el = elements.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      const text = (await el.textContent().catch(() => null))?.trim() || '';
      const ariaLabel = await el.getAttribute('aria-label').catch(() => null);
      const name = text || ariaLabel || '';

      if (/delete|remove/i.test(name)) continue;
      if (/reset setup/i.test(name)) continue;
      if (/^import$/i.test(name)) continue;

      if (await el.isVisible().catch(() => false)) {
        await page.screenshot({ path: `test-results/pre-${i}-${name.replace(/\s+/g,'-').slice(0,24)}.png`, fullPage: false });
        await el.click({ timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(50);
        await page.screenshot({ path: `test-results/post-${i}-${name.replace(/\s+/g,'-').slice(0,24)}.png`, fullPage: false });
      }

      const detailPanelOpen = await page.locator('#detail-panel.open').isVisible().catch(() => false);
      if (detailPanelOpen) {
        const sortWrap = page.locator('#detail-panel .sort-wrap');
        if (await sortWrap.isVisible().catch(() => false)) {
          const select = sortWrap.locator('select#task-sort');
          await expect(select).toBeVisible();
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
          await sortWrap.screenshot({ path: `test-results/sort-wrap-${i}.png` });
        } else {
          await page.evaluate(() => {
            const wrap = document.querySelector('#detail-panel .sort-wrap');
            if (wrap && !wrap.classList.contains('sort-wrap')) wrap.classList.add('sort-wrap');
          });
        }
      }
    }

    expect(consoleErrors, `Console errors encountered: \n${consoleErrors.join('\n')}`).toHaveLength(0);
  });
});


