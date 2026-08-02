import { expect, test } from "@playwright/test";

test("catalog remains usable when the Academy API is unavailable", async ({
  page,
}) => {
  await page.route("**/api/v1/learning-paths", (route) =>
    route.abort("failed"),
  );

  await page.goto("/learn", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByText(
      "The Academy API is unavailable, so the complete demo path remains usable.",
    ),
  ).toBeVisible();
  await expect(
    page.locator('a[href="/learn/path-risk-management"]'),
  ).toBeVisible();
});

test("public Academy navigation is keyboard reachable with visible focus", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  let focusedLearn = false;
  for (let step = 0; step < 50; step += 1) {
    await page.keyboard.press("Tab");
    focusedLearn = await page.evaluate(
      () => document.activeElement?.getAttribute("href") === "/learn",
    );
    if (focusedLearn) break;
  }

  expect(focusedLearn).toBe(true);
  const focusStyle = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement as Element);
    return {
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(focusStyle.style).not.toBe("none");
  expect(focusStyle.width).toBeGreaterThanOrEqual(2);

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/learn$/);
});
