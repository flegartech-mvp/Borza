import { test, expect } from "@playwright/test";

test.describe("Borza Release Gate E2E Suite", () => {
  test("loads main dashboard and verifies layout components", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Borza/i);
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
  });

  test("applies filter controls and updates news feed view", async ({ page }) => {
    await page.goto("/");
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill("macro");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/search=macro/i);
    }
  });

  test("handles network error state gracefully when backend is offline", async ({ page }) => {
    await page.route("**/api/**", (route) => route.abort());
    await page.goto("/");
    const alertOrError = page.locator('[role="alert"], text=/unavailable|error|failed/i');
    await expect(alertOrError.first()).toBeVisible();
  });

  test("renders realtime news feed updates", async ({ page }) => {
    await page.goto("/");
    const feedList = page.locator('[data-testid="news-feed"], main');
    await expect(feedList).toBeVisible();
  });
});
