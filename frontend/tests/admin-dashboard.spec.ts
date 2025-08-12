import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin before each test
    await page.goto('/login');
    await page.locator('input[name="email"]').fill('admin@cafe.com');
    await page.locator('input[name="password"]').fill('test123');
    await page.locator('button[type="submit"]').click();

    // Wait for successful login and redirect to admin dashboard
    await expect(page).toHaveURL(/.*admin/);
  });

  test('should display admin dashboard with all management sections', async ({
    page,
  }) => {
    // Navigate to admin dashboard
    await page.goto('/admin');

    // Verify admin dashboard loads correctly
    await expect(page.locator('h1')).toContainText(/admin dashboard/i);

    // Check that all management sections are present
    await expect(
      page.locator('[data-testid="reservations-management"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="tables-management"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="users-management"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="analytics-section"]')
    ).toBeVisible();
  });

  test('should allow viewing and filtering reservations', async ({ page }) => {
    // Navigate to admin dashboard
    await page.goto('/admin');

    // Click on reservations management section
    await page.locator('[data-testid="reservations-management"]').click();

    // Verify reservations list is displayed
    await expect(
      page.locator('[data-testid="reservations-list"]')
    ).toBeVisible();

    // Check that filters are available
    await expect(page.locator('input[type="date"]')).toBeVisible();
    await expect(page.locator('select[name="status"]')).toBeVisible();
    await expect(page.locator('select[name="table"]')).toBeVisible();

    // Test date filtering
    const today = new Date().toISOString().split('T')[0];
    await page.locator('input[type="date"]').fill(today);
    await page.locator('button[type="submit"]').click();

    // Verify filtered results
    await expect(
      page.locator('[data-testid="reservation-item"]')
    ).toBeVisible();
  });

  test('should allow editing reservation details', async ({ page }) => {
    // Navigate to admin dashboard
    await page.goto('/admin');

    // Open reservations management
    await page.locator('[data-testid="reservations-management"]').click();

    // Click on a reservation to edit
    await page.locator('[data-testid="reservation-item"]').first().click();

    // Verify edit form is displayed
    await expect(
      page.locator('[data-testid="edit-reservation-form"]')
    ).toBeVisible();

    // Modify reservation details
    await page.locator('input[name="time"]').fill('20:00');
    await page.locator('input[name="guests"]').fill('6');
    await page.locator('textarea[name="notes"]').fill('Updated by admin');

    // Save changes
    await page.getByRole('button', { name: /save changes/i }).click();

    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page).toContainText(/reservation updated/i);
  });

  test('should allow canceling reservations', async ({ page }) => {
    // Navigate to admin dashboard
    await page.goto('/admin');

    // Open reservations management
    await page.locator('[data-testid="reservations-management"]').click();

    // Find a reservation to cancel
    const reservationItem = page
      .locator('[data-testid="reservation-item"]')
      .first();
    await reservationItem.click();

    // Click cancel button
    await page.getByRole('button', { name: /cancel reservation/i }).click();

    // Confirm cancellation in modal
    await expect(
      page.locator('[data-testid="confirmation-modal"]')
    ).toBeVisible();
    await page.getByRole('button', { name: /confirm/i }).click();

    // Verify cancellation success
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page).toContainText(/reservation cancelled/i);
  });

  test('should manage table configurations', async ({ page }) => {
    // Navigate to admin dashboard
    await page.goto('/admin');

    // Open tables management
    await page.locator('[data-testid="tables-management"]').click();

    // Verify tables list is displayed
    await expect(page.locator('[data-testid="tables-list"]')).toBeVisible();

    // Add a new table
    await page.getByRole('button', { name: /add table/i }).click();

    // Fill in table details
    await page.locator('input[name="tableNumber"]').fill('15');
    await page.locator('input[name="capacity"]').fill('8');
    await page.locator('select[name="status"]').selectOption('available');
    await page
      .locator('textarea[name="description"]')
      .fill('Large corner table');

    // Save new table
    await page.getByRole('button', { name: /save table/i }).click();

    // Verify table was added
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page).toContainText(/table added/i);
  });

  test('should display real-time analytics and metrics', async ({ page }) => {
    // Navigate to admin dashboard
    await page.goto('/admin');

    // Open analytics section
    await page.locator('[data-testid="analytics-section"]').click();

    // Verify analytics dashboard is displayed
    await expect(
      page.locator('[data-testid="analytics-dashboard"]')
    ).toBeVisible();

    // Check that key metrics are displayed
    await expect(
      page.locator('[data-testid="total-reservations"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="today-reservations"]')
    ).toBeVisible();
    await expect(page.locator('[data-testid="occupancy-rate"]')).toBeVisible();
    await expect(page.locator('[data-testid="revenue-metrics"]')).toBeVisible();

    // Verify charts and graphs are present
    await expect(
      page.locator('[data-testid="reservations-chart"]')
    ).toBeVisible();
    await expect(page.locator('[data-testid="occupancy-chart"]')).toBeVisible();
  });

  test('should manage user accounts and permissions', async ({ page }) => {
    // Navigate to admin dashboard
    await page.goto('/admin');

    // Open users management
    await page.locator('[data-testid="users-management"]').click();

    // Verify users list is displayed
    await expect(page.locator('[data-testid="users-list"]')).toBeVisible();

    // Search for a specific user
    await page.locator('input[name="search"]').fill('test@example.com');
    await page.getByRole('button', { name: /search/i }).click();

    // Verify search results
    await expect(page.locator('[data-testid="user-item"]')).toBeVisible();

    // Edit user permissions
    await page.locator('[data-testid="user-item"]').first().click();
    await page.locator('select[name="role"]').selectOption('staff');
    await page.getByRole('button', { name: /update user/i }).click();

    // Verify user was updated
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page).toContainText(/user updated/i);
  });

  test('should handle bulk operations on reservations', async ({ page }) => {
    // Navigate to admin dashboard
    await page.goto('/admin');

    // Open reservations management
    await page.locator('[data-testid="reservations-management"]').click();

    // Select multiple reservations
    const checkboxes = page.locator('input[type="checkbox"]');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    // Perform bulk action
    await page.locator('select[name="bulk-action"]').selectOption('cancel');
    await page.getByRole('button', { name: /apply bulk action/i }).click();

    // Confirm bulk action
    await expect(
      page.locator('[data-testid="confirmation-modal"]')
    ).toBeVisible();
    await page.getByRole('button', { name: /confirm/i }).click();

    // Verify bulk action success
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page).toContainText(/bulk action completed/i);
  });

  test('should export reservation data', async ({ page }) => {
    // Navigate to admin dashboard
    await page.goto('/admin');

    // Open reservations management
    await page.locator('[data-testid="reservations-management"]').click();

    // Set up export filters
    const today = new Date().toISOString().split('T')[0];
    await page.locator('input[type="date"]').fill(today);

    // Export data
    await page.getByRole('button', { name: /export csv/i }).click();

    // Verify download started (this would need to be handled differently in actual implementation)
    // For now, just verify the button is functional
    await expect(
      page.getByRole('button', { name: /export csv/i })
    ).toBeEnabled();
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate to admin dashboard
    await page.goto('/admin');

    // Verify mobile-friendly layout
    await expect(page.locator('nav')).toBeVisible();

    // Check that admin sections are accessible on mobile
    await expect(
      page.locator('[data-testid="reservations-management"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="tables-management"]')
    ).toBeVisible();

    // Verify touch-friendly interface
    const buttons = page.locator('button');
    for (const button of await buttons.all()) {
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThan(44); // Minimum touch target size
      expect(box?.height).toBeGreaterThan(44);
    }
  });
});
