import { test, expect } from '@playwright/test';

test.describe('Customer Reservation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the home page before each test
    await page.goto('/');
  });

  test('should display home page with navigation to reservations', async ({
    page,
  }) => {
    // Check that the home page loads correctly
    await expect(page).toHaveTitle(/Cafe Reservation/);

    // Verify navigation elements are present
    await expect(page.locator('nav')).toBeVisible();
    await expect(
      page.getByRole('link', { name: /reservations/i })
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /login/i })).toBeVisible();
  });

  test('should navigate to reservations page and display table availability', async ({
    page,
  }) => {
    // Navigate to reservations page
    await page.getByRole('link', { name: /reservations/i }).click();
    await expect(page).toHaveURL(/.*reservations/);

    // Check that the reservations page loads
    await expect(page.locator('h1')).toContainText(/reservations/i);

    // Verify table availability section is present
    await expect(
      page.locator('[data-testid="table-availability"]')
    ).toBeVisible();

    // Check that date picker is available
    await expect(page.locator('input[type="date"]')).toBeVisible();
  });

  test('should allow user to select date and view available tables', async ({
    page,
  }) => {
    // Navigate to reservations page
    await page.goto('/reservations');

    // Select a future date (tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateString = tomorrow.toISOString().split('T')[0];

    await page.locator('input[type="date"]').fill(dateString);

    // Wait for tables to load
    await page.waitForSelector('[data-testid="table-item"]', {
      timeout: 10000,
    });

    // Verify tables are displayed
    const tables = page.locator('[data-testid="table-item"]');
    await expect(tables.first()).toBeVisible();

    // Check that table information is displayed
    await expect(page.locator('[data-testid="table-capacity"]')).toBeVisible();
    await expect(page.locator('[data-testid="table-status"]')).toBeVisible();
  });

  test('should require login before making a reservation', async ({ page }) => {
    // Navigate to reservations page
    await page.goto('/reservations');

    // Try to select a table without being logged in
    await page.locator('[data-testid="table-item"]').first().click();

    // Should redirect to login page or show login prompt
    await expect(page).toHaveURL(/.*login/);
  });

  test('should complete full reservation workflow for logged-in user', async ({
    page,
  }) => {
    // First, login (assuming we have test credentials)
    await page.goto('/login');
    await page.locator('input[name="email"]').fill('test@example.com');
    await page.locator('input[name="password"]').fill('testpassword');
    await page.getByRole('button', { name: /login/i }).click();

    // Wait for successful login
    await expect(page).toHaveURL(/.*profile/);

    // Navigate to reservations
    await page.goto('/reservations');

    // Select a future date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateString = tomorrow.toISOString().split('T')[0];
    await page.locator('input[type="date"]').fill(dateString);

    // Wait for tables to load
    await page.waitForSelector('[data-testid="table-item"]', {
      timeout: 10000,
    });

    // Select an available table
    const availableTable = page
      .locator('[data-testid="table-item"]')
      .filter({ hasText: /available/i });
    await availableTable.first().click();

    // Fill in reservation details
    await page.locator('input[name="time"]').fill('19:00');
    await page.locator('input[name="guests"]').fill('4');
    await page.locator('textarea[name="notes"]').fill('Window seat preferred');

    // Submit reservation
    await page.getByRole('button', { name: /book reservation/i }).click();

    // Verify confirmation
    await expect(
      page.locator('[data-testid="reservation-confirmation"]')
    ).toBeVisible();
    await expect(page).toContainText(/reservation confirmed/i);
  });

  test('should handle reservation conflicts gracefully', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.locator('input[name="email"]').fill('test@example.com');
    await page.locator('input[name="password"]').fill('testpassword');
    await page.getByRole('button', { name: /login/i }).click();

    // Navigate to reservations
    await page.goto('/reservations');

    // Try to book a table that's already reserved
    const reservedTable = page
      .locator('[data-testid="table-item"]')
      .filter({ hasText: /reserved/i });
    await reservedTable.first().click();

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page).toContainText(/already reserved/i);
  });

  test('should display real-time updates for table availability', async ({
    page,
  }) => {
    // Navigate to reservations page
    await page.goto('/reservations');

    // Wait for real-time connection to establish
    await page.waitForSelector('[data-testid="realtime-status"]', {
      timeout: 10000,
    });

    // Verify real-time status is connected
    await expect(page.locator('[data-testid="realtime-status"]')).toContainText(
      /connected/i
    );

    // Check that tables update in real-time (this would require a second browser instance to simulate)
    // For now, just verify the real-time indicator is present
    await expect(
      page.locator('[data-testid="realtime-indicator"]')
    ).toBeVisible();
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate to reservations page
    await page.goto('/reservations');

    // Verify mobile-friendly layout
    await expect(page.locator('nav')).toBeVisible();

    // Check that tables are displayed in a mobile-friendly format
    await expect(page.locator('[data-testid="table-item"]')).toBeVisible();

    // Verify touch-friendly buttons
    const buttons = page.locator('button');
    for (const button of await buttons.all()) {
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThan(44); // Minimum touch target size
      expect(box?.height).toBeGreaterThan(44);
    }
  });
});
