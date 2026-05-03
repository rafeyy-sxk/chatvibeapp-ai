/**
 * E2E Tests - Admin Panel Access Control
 * Playwright tests for admin authorization
 */

import { test, expect } from "@playwright/test";

test.describe("Admin Panel Access Control", () => {
  test("should allow admin user to access admin panel", async ({ page }) => {
    // Mock admin user
    await page.goto("http://localhost:3000");
    await page.evaluate(() => {
      sessionStorage.setItem("cv_access_token", "admin-token");
      sessionStorage.setItem("cv_user", JSON.stringify({
        id: "admin-123",
        username: "admin",
        role: "admin",
      }));
    });

    // Mock admin check API
    await page.route("**/api/admin/**", (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ authorized: true }),
      });
    });

    await page.goto("http://localhost:3000/admin");

    // Should load admin panel
    await expect(page.locator("text=Admin")).toBeVisible();
  });

  test("should deny non-admin user access to admin panel", async ({ page }) => {
    // Mock regular user
    await page.goto("http://localhost:3000");
    await page.evaluate(() => {
      sessionStorage.setItem("cv_access_token", "user-token");
      sessionStorage.setItem("cv_user", JSON.stringify({
        id: "user-123",
        username: "regularuser",
        role: "user",
      }));
    });

    // Mock admin check API - returns forbidden
    await page.route("**/api/admin/**", (route) => {
      route.fulfill({
        status: 403,
        body: JSON.stringify({ error: "Forbidden" }),
      });
    });

    await page.goto("http://localhost:3000/admin");

    // Should show forbidden or redirect
    await expect(page.locator("text=Forbidden").or(page.locator("text=403"))).toBeVisible();
  });

  test("should require authentication for admin routes", async ({ page }) => {
    // No auth token
    await page.goto("http://localhost:3000/admin");

    // Should redirect to login or show unauthorized
    await expect(
      page.locator("text=Unauthorized").or(page).toHaveURL(/.*\/login/)
    ).toBeTruthy();
  });
});

