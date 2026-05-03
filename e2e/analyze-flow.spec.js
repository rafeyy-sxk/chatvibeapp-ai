/**
 * E2E Tests - Analyze Flow
 * Playwright tests for upload → analyze → queue → stream → result flow
 */

import { test, expect } from "@playwright/test";

test.describe("Analyze Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Set auth token
    await page.goto("http://localhost:3000");
    await page.evaluate(() => {
      sessionStorage.setItem("cv_access_token", "mock-access-token");
    });
  });

  test("should complete full analyze flow", async ({ page }) => {
    // Mock analyze API - returns job ID
    await page.route("**/api/analyze", (route) => {
      route.fulfill({
        status: 202,
        body: JSON.stringify({
          jobId: "job-123",
          status: "PENDING",
          progress: 0,
        }),
      });
    });

    // Mock job status API
    let progressCount = 0;
    await page.route("**/api/jobs/job-123/status", (route) => {
      const statuses = [
        { status: "PENDING", progress: 0 },
        { status: "PROCESSING", progress: 25 },
        { status: "PROCESSING", progress: 50 },
        { status: "PROCESSING", progress: 75 },
        { status: "COMPLETED", progress: 100, reportId: "report-123" },
      ];

      route.fulfill({
        status: 200,
        body: JSON.stringify(statuses[progressCount] || statuses[statuses.length - 1]),
      });

      if (progressCount < statuses.length - 1) {
        progressCount++;
      }
    });

    // Mock SSE stream
    await page.route("**/api/jobs/job-123/stream**", (route) => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const messages = [
            { type: "connected", jobId: "job-123" },
            { type: "update", job: { status: "PROCESSING", progress: 50 } },
            { type: "completed", reportId: "report-123" },
          ];

          messages.forEach((msg, index) => {
            setTimeout(() => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
              if (index === messages.length - 1) {
                controller.close();
              }
            }, index * 100);
          });
        },
      });

      route.fulfill({
        status: 200,
        body: stream,
        headers: {
          "Content-Type": "text/event-stream",
        },
      });
    });

    // Mock report API
    await page.route("**/api/reports/report-123", (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          id: "report-123",
          geminiSummary: {
            summary: "Test analysis",
            overall_vibe: "positive",
            metrics: { flirty: 10 },
          },
          analytics: {
            sentimentTimeline: [],
            toxicity: { average: 0 },
          },
        }),
      });
    });

    await page.goto("http://localhost:3000/upload");

    // Simulate file upload
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test.png",
      mimeType: "image/png",
      buffer: Buffer.from("fake-image-data"),
    });

    // Submit form
    await page.click('button[type="submit"]');

    // Should show job status
    await expect(page.locator("text=Processing")).toBeVisible({ timeout: 5000 });

    // Should eventually show completed status
    await expect(page.locator("text=Completed")).toBeVisible({ timeout: 10000 });
  });

  test("should handle analyze error", async ({ page }) => {
    await page.route("**/api/analyze", (route) => {
      route.fulfill({
        status: 400,
        body: JSON.stringify({ error: "No images provided" }),
      });
    });

    await page.goto("http://localhost:3000/upload");
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator("text=No images provided")).toBeVisible();
  });
});

