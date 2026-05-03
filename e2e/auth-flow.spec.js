/**
 * E2E Tests - Auth Flow
 * Playwright tests for authentication flows
 */

import { test, expect } from "@playwright/test";

test.describe("Auth Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses
    await page.route("**/api/health", (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ status: "ok" }),
      });
    });
  });

  test("should complete login flow", async ({ page }) => {
    // Mock CSRF token
    await page.context().addCookies([
      {
        name: "cv_csrf",
        value: "test-csrf-token",
        domain: "localhost",
        path: "/",
      },
    ]);

    // Mock login API
    await page.route("**/api/auth/login", (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          accessToken: "mock-access-token",
          user: { id: "user-123", username: "testuser" },
        }),
      });
    });

    await page.goto("http://localhost:3000/login");

    // Fill login form
    await page.fill('input[name="username"]', "testuser");
    await page.fill('input[name="password"]', "testpassword");

    // Submit form
    await page.click('button[type="submit"]');

    // Should redirect to upload page
    await expect(page).toHaveURL(/.*\/upload/);
  });

  test("should handle login failure", async ({ page }) => {
    await page.context().addCookies([
      {
        name: "cv_csrf",
        value: "test-csrf-token",
        domain: "localhost",
        path: "/",
      },
    ]);

    // Mock failed login
    await page.route("**/api/auth/login", (route) => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ error: "Invalid credentials" }),
      });
    });

    await page.goto("http://localhost:3000/login");

    await page.fill('input[name="username"]', "testuser");
    await page.fill('input[name="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator("text=Invalid credentials")).toBeVisible();
  });

  test("should complete logout flow", async ({ page }) => {
    // Set session storage
    await page.goto("http://localhost:3000");
    await page.evaluate(() => {
      sessionStorage.setItem("cv_access_token", "mock-token");
      sessionStorage.setItem("cv_user", JSON.stringify({ id: "user-123" }));
    });

    // Mock logout API
    await page.route("**/api/auth/logout", (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    // Navigate to logout (or click logout button)
    await page.goto("http://localhost:3000/logout");

    // Should clear session storage
    const token = await page.evaluate(() => sessionStorage.getItem("cv_access_token"));
    expect(token).toBeNull();
  });
});

