import { test, expect } from '@playwright/test';

test.describe('Authentication and User Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page before each test
    await page.goto('/');
  });

  test('should display login form with proper validation', async ({ page }) => {
    // Navigate to login page
    await page.getByRole('link', { name: /login/i }).click();
    await expect(page).toHaveURL(/.*login/);

    // Verify login form elements
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible();

    // Test form validation
    await page.getByRole('button', { name: /login/i }).click();

    // Should show validation errors
    await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Fill in valid credentials
    await page.locator('input[name="email"]').fill('test@example.com');
    await page.locator('input[name="password"]').fill('testpassword');
    await page.getByRole('button', { name: /login/i }).click();

    // Should redirect to profile or dashboard
    await expect(page).toHaveURL(/.*profile|.*admin/);

    // Verify user is logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    await expect(page.locator('[data-testid="logout-button"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Fill in invalid credentials
    await page.locator('input[name="email"]').fill('invalid@example.com');
    await page.locator('input[name="password"]').fill('wrongpassword');
    await page.getByRole('button', { name: /login/i }).click();

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page).toContainText(/invalid credentials/i);
  });

  test('should display signup form with validation', async ({ page }) => {
    // Navigate to signup page
    await page.getByRole('link', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/.*signup/);

    // Verify signup form elements
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign up/i })).toBeVisible();

    // Test form validation
    await page.getByRole('button', { name: /sign up/i }).click();

    // Should show validation errors
    await expect(page.locator('[data-testid="name-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
  });

  test('should successfully create new user account', async ({ page }) => {
    // Navigate to signup page
    await page.goto('/signup');

    // Generate unique email for testing
    const uniqueEmail = `test${Date.now()}@example.com`;

    // Fill in signup form
    await page.locator('input[name="name"]').fill('Test User');
    await page.locator('input[name="email"]').fill(uniqueEmail);
    await page.locator('input[name="password"]').fill('testpassword123');
    await page.locator('input[name="confirmPassword"]').fill('testpassword123');
    await page.getByRole('button', { name: /sign up/i }).click();

    // Should redirect to profile or show success message
    await expect(page).toHaveURL(/.*profile|.*login/);

    // Verify account creation success
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page).toContainText(/account created/i);
  });

  test('should enforce password requirements', async ({ page }) => {
    // Navigate to signup page
    await page.goto('/signup');

    // Try to sign up with weak password
    await page.locator('input[name="name"]').fill('Test User');
    await page.locator('input[name="email"]').fill('test@example.com');
    await page.locator('input[name="password"]').fill('123');
    await page.locator('input[name="confirmPassword"]').fill('123');
    await page.getByRole('button', { name: /sign up/i }).click();

    // Should show password requirement error
    await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
    await expect(page).toContainText(/password must be/i);
  });

  test('should enforce password confirmation match', async ({ page }) => {
    // Navigate to signup page
    await page.goto('/signup');

    // Fill in form with mismatched passwords
    await page.locator('input[name="name"]').fill('Test User');
    await page.locator('input[name="email"]').fill('test@example.com');
    await page.locator('input[name="password"]').fill('testpassword123');
    await page
      .locator('input[name="confirmPassword"]')
      .fill('differentpassword');
    await page.getByRole('button', { name: /sign up/i }).click();

    // Should show password mismatch error
    await expect(
      page.locator('[data-testid="confirm-password-error"]')
    ).toBeVisible();
    await expect(page).toContainText(/passwords do not match/i);
  });

  test('should enforce email format validation', async ({ page }) => {
    // Navigate to signup page
    await page.goto('/signup');

    // Try to sign up with invalid email
    await page.locator('input[name="name"]').fill('Test User');
    await page.locator('input[name="email"]').fill('invalid-email');
    await page.locator('input[name="password"]').fill('testpassword123');
    await page.locator('input[name="confirmPassword"]').fill('testpassword123');
    await page.getByRole('button', { name: /sign up/i }).click();

    // Should show email format error
    await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
    await expect(page).toContainText(/valid email/i);
  });

  test('should prevent duplicate email registration', async ({ page }) => {
    // Navigate to signup page
    await page.goto('/signup');

    // Try to sign up with existing email
    await page.locator('input[name="name"]').fill('Test User');
    await page.locator('input[name="email"]').fill('test@example.com');
    await page.locator('input[name="password"]').fill('testpassword123');
    await page.locator('input[name="confirmPassword"]').fill('testpassword123');
    await page.getByRole('button', { name: /sign up/i }).click();

    // Should show duplicate email error
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page).toContainText(/email already exists/i);
  });

  test('should implement role-based access control', async ({ page }) => {
    // Login as regular user
    await page.goto('/login');
    await page.locator('input[name="email"]').fill('test@example.com');
    await page.locator('input[name="password"]').fill('testpassword');
    await page.getByRole('button', { name: /login/i }).click();

    // Try to access admin page
    await page.goto('/admin');

    // Should be denied access
    await expect(page).toHaveURL(/.*login|.*403/);
    await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();
  });

  test('should allow admin access to admin dashboard', async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.locator('input[name="email"]').fill('admin@cafe.com');
    await page.locator('input[name="password"]').fill('test123');
    await page.locator('button[type="submit"]').click();

    // Navigate to admin page
    await page.goto('/admin');

    // Should have access to admin dashboard
    await expect(page).toHaveURL(/.*admin/);
    await expect(page.locator('h1')).toContainText(/admin dashboard/i);
  });

  test('should handle session management and logout', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.locator('input[name="email"]').fill('test@example.com');
    await page.locator('input[name="password"]').fill('testpassword');
    await page.getByRole('button', { name: /login/i }).click();

    // Verify user is logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();

    // Logout
    await page.locator('[data-testid="logout-button"]').click();

    // Should redirect to home page
    await expect(page).toHaveURL(/.*\/$/);

    // Verify user is logged out
    await expect(page.getByRole('link', { name: /login/i })).toBeVisible();
    await expect(page.locator('[data-testid="user-menu"]')).not.toBeVisible();
  });

  test('should handle session expiration', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.locator('input[name="email"]').fill('test@example.com');
    await page.locator('input[name="password"]').fill('testpassword');
    await page.getByRole('button', { name: /login/i }).click();

    // Navigate to a protected page
    await page.goto('/profile');

    // Simulate session expiration (this would need to be handled in the backend)
    // For now, just verify the page loads correctly
    await expect(page).toHaveURL(/.*profile/);

    // In a real scenario, we would need to expire the session and verify redirect
  });

  test('should provide password reset functionality', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Click on forgot password link
    await page.getByRole('link', { name: /forgot password/i }).click();

    // Should show password reset form
    await expect(
      page.locator('[data-testid="password-reset-form"]')
    ).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();

    // Fill in email
    await page.locator('input[name="email"]').fill('test@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page).toContainText(/reset link sent/i);
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate to login page
    await page.goto('/login');

    // Verify mobile-friendly layout
    await expect(page.locator('form')).toBeVisible();

    // Check that form elements are properly sized for mobile
    const inputs = page.locator('input');
    for (const input of await inputs.all()) {
      const box = await input.boundingBox();
      expect(box?.width).toBeGreaterThan(200); // Minimum width for mobile
      expect(box?.height).toBeGreaterThan(44); // Minimum touch target height
    }

    // Verify buttons are touch-friendly
    const buttons = page.locator('button');
    for (const button of await buttons.all()) {
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThan(44); // Minimum touch target size
      expect(box?.height).toBeGreaterThan(44);
    }
  });
});
