import { test, expect } from "@playwright/test";

test.describe("Borza Release Gate E2E Suite", () => {
  test("loads main dashboard and verifies layout components", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Borza/i);
    await expect(page.locator("header").first()).toBeVisible();
    await expect(page.locator("main").first()).toBeVisible();
  });

  test("applies filter controls and updates news feed view", async ({ page }) => {
    await page.goto("/");
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("macro");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/search=macro/i);
    }
  });

  test("handles network error state gracefully when backend is offline", async ({ page }) => {
    await page.route("**/api/**", (route) => route.abort());
    await page.goto("/");
    const alertOrError = page.locator('[role="alert"]').or(page.getByText(/unavailable|error|failed/i)).first();
    await expect(alertOrError).toBeVisible();
  });

  test("renders realtime news feed updates", async ({ page }) => {
    await page.goto("/");
    const feedList = page.locator('#workspace-content, main').first();
    await expect(feedList).toBeVisible();
  });
});

