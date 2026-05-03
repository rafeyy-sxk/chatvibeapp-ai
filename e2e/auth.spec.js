import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("should allow user to sign up and log in", async ({ page }) => {
    // Navigate to signup page
    await page.goto("/signup");

    // Wait for page to load
    await expect(page.locator("h1")).toContainText(/sign up/i);

    // Generate unique username
    const timestamp = Date.now();
    const username = `testuser_${timestamp}`;
    const email = `${username}@example.com`;
    const password = "TestPass123!";

    // Fill signup form
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);

    // Submit form
    await page.click('button[type="submit"]');

    // Should redirect to upload or show success
    await page.waitForURL(/\/(upload|analysis)/, { timeout: 5000 });

    // Verify token is stored
    const token = await page.evaluate(() => {
      return window.sessionStorage.getItem("cv_access_token");
    });
    expect(token).toBeTruthy();
  });

  test("should allow user to log in with existing credentials", async ({ page }) => {
    // First, create a user via signup
    await page.goto("/signup");
    const timestamp = Date.now();
    const username = `loginuser_${timestamp}`;
    const email = `${username}@example.com`;
    const password = "TestPass123!";

    await page.fill('input[name="username"]', username);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(upload|analysis)/, { timeout: 5000 });

    // Logout
    await page.goto("/api/auth/logout", { waitUntil: "networkidle" });

    // Clear session storage
    await page.evaluate(() => {
      window.sessionStorage.clear();
    });

    // Now test login
    await page.goto("/login");
    await expect(page.locator("h1")).toContainText(/log in/i);

    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // Should redirect after login
    await page.waitForURL(/\/(upload|analysis)/, { timeout: 5000 });

    // Verify token is stored
    const token = await page.evaluate(() => {
      return window.sessionStorage.getItem("cv_access_token");
    });
    expect(token).toBeTruthy();
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.fill('input[name="username"]', "nonexistent_user");
    await page.fill('input[name="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator("text=/invalid|error|incorrect/i")).toBeVisible({ timeout: 5000 });
  });

  test("should require authentication for protected routes", async ({ page }) => {
    // Clear any existing auth
    await page.evaluate(() => {
      window.sessionStorage.clear();
    });

    // Try to access upload page
    await page.goto("/upload");
    
    // Should redirect to login or show auth error
    await page.waitForURL(/\/(login|signup)/, { timeout: 5000 });
  });
});

