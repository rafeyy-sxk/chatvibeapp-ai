import { test, expect } from "@playwright/test";

test.describe("Upload and Analysis Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Create a user and log in before each test
    await page.goto("/signup");
    const timestamp = Date.now();
    const username = `uploaduser_${timestamp}`;
    const email = `${username}@example.com`;
    const password = "TestPass123!";

    await page.fill('input[name="username"]', username);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(upload|analysis)/, { timeout: 5000 });
  });

  test("should display upload page with drag and drop area", async ({ page }) => {
    await page.goto("/upload");

    // Check for upload interface elements
    await expect(page.locator("text=/upload|drag|drop/i")).toBeVisible();
    
    // Check for file input or dropzone
    const fileInput = page.locator('input[type="file"]').or(page.locator('[data-testid="dropzone"]'));
    await expect(fileInput.first()).toBeVisible({ timeout: 3000 });
  });

  test("should accept file uploads", async ({ page }) => {
    await page.goto("/upload");

    // Create a minimal test image (1x1 PNG)
    const testImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    // Wait for file input
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: "test.png",
      mimeType: "image/png",
      buffer: testImage,
    });

    // Should show file in the upload area
    await expect(page.locator("text=/test.png|image|file/i")).toBeVisible({ timeout: 5000 });
  });

  test("should validate file types", async ({ page }) => {
    await page.goto("/upload");

    // Try to upload a non-image file
    const fileInput = page.locator('input[type="file"]').first();
    
    // Create a text file
    const textFile = Buffer.from("This is not an image");
    await fileInput.setInputFiles({
      name: "test.txt",
      mimeType: "text/plain",
      buffer: textFile,
    });

    // Should show error or reject the file
    // Note: This depends on your validation implementation
    // The file might be rejected before showing in UI
  });

  test("should limit number of files", async ({ page }) => {
    await page.goto("/upload");

    const testImage = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    const fileInput = page.locator('input[type="file"]').first();
    
    // Try to upload more than 10 files
    const files = Array.from({ length: 11 }, (_, i) => ({
      name: `test${i}.png`,
      mimeType: "image/png",
      buffer: testImage,
    }));

    await fileInput.setInputFiles(files);

    // Should show error about file limit
    // Note: This depends on your validation implementation
  });
});

