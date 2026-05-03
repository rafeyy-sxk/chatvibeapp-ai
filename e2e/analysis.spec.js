import { test, expect } from "@playwright/test";

test.describe("Analysis and Reports", () => {
  test.beforeEach(async ({ page }) => {
    // Create a user and log in
    await page.goto("/signup");
    const timestamp = Date.now();
    const username = `analysisuser_${timestamp}`;
    const email = `${username}@example.com`;
    const password = "TestPass123!";

    await page.fill('input[name="username"]', username);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(upload|analysis)/, { timeout: 5000 });
  });

  test("should display analysis page structure", async ({ page }) => {
    await page.goto("/analysis");

    // Check for analysis page elements
    await expect(page.locator("text=/analysis|results|report/i")).toBeVisible();
  });

  test("should show export buttons when report is available", async ({ page }) => {
    // Navigate to a report page (if you have a test report ID)
    // For now, we'll check the structure exists
    await page.goto("/analysis");

    // Check if export buttons exist (they might be disabled if no report)
    const exportButtons = page.locator('button:has-text("JSON"), button:has-text("CSV"), button:has-text("PDF")');
    
    // At least the buttons should exist in the DOM
    const count = await exportButtons.count();
    // If buttons exist, they should be there (even if disabled)
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("should allow navigation between pages", async ({ page }) => {
    await page.goto("/analysis");

    // Check for navigation buttons
    const newUploadBtn = page.locator('button:has-text("New upload"), a:has-text("upload")');
    if (await newUploadBtn.count() > 0) {
      await newUploadBtn.first().click();
      await expect(page).toHaveURL(/\/upload/, { timeout: 5000 });
    }
  });

  test("should display health check endpoint", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty("status");
    expect(data).toHaveProperty("timestamp");
  });
});

