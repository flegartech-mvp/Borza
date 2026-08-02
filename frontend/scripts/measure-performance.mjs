import { chromium } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://127.0.0.1:3210";
const routes = ["/", "/learn", "/lesson/lesson-ff-finance-map"];
const browser = await chromium.launch();
const results = [];

try {
  for (const route of routes) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__borzaVitals = { cls: 0, lcp: 0, layoutShiftSources: [] };
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries.at(-1);
        if (last) window.__borzaVitals.lcp = last.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            window.__borzaVitals.cls += entry.value;
            window.__borzaVitals.layoutShiftSources.push(
              ...(entry.sources || []).map((source) =>
                source.node?.outerHTML?.replace(/\s+/g, " ").slice(0, 240),
              ),
            );
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    });

    for (let run = 1; run <= 3; run += 1) {
      const response = await page.goto(`${baseURL}${route}`, {
        waitUntil: "networkidle",
      });
      await page.waitForTimeout(500);
      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType("navigation")[0];
        const resources = performance.getEntriesByType("resource");
        const scripts = resources.filter(
          (entry) =>
            entry.initiatorType === "script" || entry.name.includes(".js"),
        );
        return {
          ttfbMs: navigation.responseStart,
          domContentLoadedMs: navigation.domContentLoadedEventEnd,
          loadMs: navigation.loadEventEnd,
          lcpMs: window.__borzaVitals.lcp,
          cls: window.__borzaVitals.cls,
          layoutShiftSources: [
            ...new Set(window.__borzaVitals.layoutShiftSources),
          ].filter(Boolean),
          jsTransferBytes: scripts.reduce(
            (sum, entry) => sum + entry.transferSize,
            0,
          ),
          resourceCount: resources.length,
        };
      });
      results.push({ route, run, status: response?.status() ?? 0, ...metrics });
    }
    await context.close();
  }
} finally {
  await browser.close();
}

const violations = results.filter(
  (item) =>
    item.status !== 200 ||
    item.loadMs > 3_000 ||
    item.lcpMs > 2_500 ||
    item.cls > 0.1 ||
    item.jsTransferBytes > 1_500_000,
);

console.log(JSON.stringify({ baseURL, results, violations }, null, 2));
if (violations.length > 0) process.exitCode = 1;
