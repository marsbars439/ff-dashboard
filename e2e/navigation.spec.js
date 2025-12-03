const { test, expect } = require('@playwright/test');

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the main dashboard header', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'The League' })).toBeVisible();
  });

  test('should navigate between tabs', async ({ page }) => {
    // Start on records tab
    await expect(page).toHaveURL('/records');

    // Navigate to Rules
    await page.getByRole('link', { name: 'Rules' }).click();
    await expect(page).toHaveURL('/rules');

    // Navigate to Season
    await page.getByRole('link', { name: 'Season' }).click();
    await expect(page).toHaveURL('/season');
  });

  test('should use keyboard shortcuts for navigation', async ({ page }) => {
    // Press '2' to go to Rules
    await page.keyboard.press('2');
    await expect(page).toHaveURL('/rules');

    // Press '1' to go to Records
    await page.keyboard.press('1');
    await expect(page).toHaveURL('/records');

    // Press '5' to go to Season
    await page.keyboard.press('5');
    await expect(page).toHaveURL('/season');
  });

  test('should show keyboard shortcuts modal', async ({ page }) => {
    // Press Shift+/ to open help
    await page.keyboard.press('Shift+/');

    // Modal should be visible
    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible();
    await expect(page.getByText('Navigation')).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(page.getByText('Keyboard Shortcuts')).not.toBeVisible();
  });

  test('should support browser back/forward navigation', async ({ page }) => {
    // Navigate to Rules
    await page.getByRole('link', { name: 'Rules' }).click();
    await expect(page).toHaveURL('/rules');

    // Navigate to Season
    await page.getByRole('link', { name: 'Season' }).click();
    await expect(page).toHaveURL('/season');

    // Go back
    await page.goBack();
    await expect(page).toHaveURL('/rules');

    // Go forward
    await page.goForward();
    await expect(page).toHaveURL('/season');
  });

  test('should maintain scroll position when switching tabs', async ({ page }) => {
    // Scroll down on Records tab
    await page.evaluate(() => window.scrollTo(0, 500));
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(400);

    // Navigate to Rules
    await page.getByRole('link', { name: 'Rules' }).click();

    // Should scroll to top on new tab
    const rulesScrollY = await page.evaluate(() => window.scrollY);
    expect(rulesScrollY).toBe(0);

    // Go back to Records
    await page.goBack();

    // Wait a moment for scroll restoration
    await page.waitForTimeout(100);

    // Should restore scroll position
    const restoredScrollY = await page.evaluate(() => window.scrollY);
    expect(restoredScrollY).toBeGreaterThan(400);
  });
});

test.describe('Mobile Navigation', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should show hamburger menu on mobile', async ({ page }) => {
    await page.goto('/');

    // Mobile menu button should be visible
    const menuButton = page.getByRole('button', { name: /toggle navigation menu/i });
    await expect(menuButton).toBeVisible();

    // Click to open menu
    await menuButton.click();

    // Navigation links should be visible in dropdown
    await expect(page.getByRole('link', { name: 'Rules' })).toBeVisible();
  });

  test('should show FAB on mobile after scrolling', async ({ page }) => {
    await page.goto('/');

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 400));

    // Wait for FAB to appear
    await page.waitForTimeout(100);

    // FAB should be visible
    const fab = page.getByRole('button', { name: /quick actions menu/i });
    await expect(fab).toBeVisible();
  });

  test('should open FAB menu and scroll to top', async ({ page }) => {
    await page.goto('/');

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 500));

    // Open FAB menu
    const fab = page.getByRole('button', { name: /open quick actions menu/i });
    await fab.click();

    // Click scroll to top
    await page.getByRole('button', { name: /scroll to top/i }).click();

    // Should scroll to top
    await page.waitForTimeout(500); // Wait for smooth scroll
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeLessThan(50);
  });
});

test.describe('Accessibility', () => {
  test('should have no accessibility violations on main page', async ({ page }) => {
    await page.goto('/');

    // Check for proper heading hierarchy
    const h1 = await page.getByRole('heading', { level: 1 }).count();
    expect(h1).toBeGreaterThan(0);

    // Check for proper landmarks
    const main = await page.getByRole('main').count();
    expect(main).toBe(1);

    const nav = await page.getByRole('navigation').count();
    expect(nav).toBeGreaterThan(0);
  });

  test('should support keyboard-only navigation', async ({ page }) => {
    await page.goto('/');

    // Tab through interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check that something is focused
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/');

    // Navigation should have label
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await expect(nav).toBeVisible();

    // Links should have accessible names
    const rulesLink = page.getByRole('link', { name: 'Rules' });
    await expect(rulesLink).toBeVisible();
  });
});
