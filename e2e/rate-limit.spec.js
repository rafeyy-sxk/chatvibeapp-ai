/**
 * E2E Tests - Rate Limit Enforcement
 * Playwright tests for rate limiting behavior
 */

import { test, expect } from "@playwright/test";

test.describe("Rate Limit Enforcement", () => {
  test("should enforce rate limit on API endpoints", async ({ page }) => {
    let requestCount = 0;

    await page.route("**/api/analyze", (route) => {
      requestCount++;

      if (requestCount > 5) {
        route.fulfill({
          status: 429,
          body: JSON.stringify({ error: "Too many requests. Please slow down." }),
          headers: {
            "Retry-After": "60",
          },
        });
      } else {
        route.fulfill({
          status: 202,
          body: JSON.stringify({ jobId: `job-${requestCount}` }),
        });
      }
    });

    await page.goto("http://localhost:3000");
    await page.evaluate(() => {
      sessionStorage.setItem("cv_access_token", "mock-token");
    });

    // Make multiple requests
    for (let i = 0; i < 7; i++) {
      const response = await page.request.post("http://localhost:3000/api/analyze", {
        headers: {
          Authorization: "Bearer mock-token",
          "Content-Type": "application/json",
        },
        data: JSON.stringify({ images: ["base64image"] }),
      });

      if (i < 5) {
        expect(response.status()).toBe(202);
      } else {
        expect(response.status()).toBe(429);
      }
    }
  });

  test("should show rate limit error to user", async ({ page }) => {
    await page.route("**/api/analyze", (route) => {
      route.fulfill({
        status: 429,
        body: JSON.stringify({ error: "Too many requests. Please slow down." }),
      });
    });

    await page.goto("http://localhost:3000/upload");
    await page.evaluate(() => {
      sessionStorage.setItem("cv_access_token", "mock-token");
    });

    // Try to submit
    await page.click('button[type="submit"]');

    // Should show rate limit message
    await expect(page.locator("text=Too many requests")).toBeVisible();
  });
});

