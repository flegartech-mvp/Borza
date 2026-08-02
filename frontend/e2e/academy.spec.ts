import { expect, test, type Page } from "@playwright/test";
import axe, { type AxeResults } from "axe-core";

declare global {
  interface Window {
    axe: typeof axe;
  }
}

const DEMO_STORAGE_KEY = "borza-academy-demo-v1";
const LANGUAGE_STORAGE_KEY = "borza-academy-language";
const THEME_STORAGE_KEY = "borza-academy-theme";

const EMPTY_DEMO_STATE = {
  version: 1,
  onboarding: null,
  completedLessons: [],
  bookmarks: [],
  lessonNotes: {},
  quizScores: {},
  reviewCards: {},
  journalEntries: [],
  simulatorSummary: null,
};

const LESSON_PATH = "/lesson/lesson-ff-finance-map";
const QUIZ_PATH = "/quiz/lesson-ff-finance-map";

const MAIN_ROUTES = [
  "/",
  "/sign-in",
  "/register",
  "/forgot-password",
  "/update-password",
  "/onboarding",
  "/home",
  "/learn",
  "/learn/path-finance-foundations",
  "/learn/path-finance-foundations/module-ff-map",
  LESSON_PATH,
  QUIZ_PATH,
  "/practice",
  "/review",
  "/simulator",
  "/simulator/results",
  "/tools",
  "/journal",
  "/glossary",
  "/progress",
  "/achievements",
  "/settings",
  "/profile",
] as const;

const PRIMARY_ROUTES = [
  "/",
  "/home",
  "/learn",
  LESSON_PATH,
  QUIZ_PATH,
  "/practice",
  "/review",
  "/simulator",
  "/tools",
  "/journal",
  "/profile",
] as const;

const ACCESSIBILITY_ROUTES = [
  "/",
  "/home",
  "/learn",
  LESSON_PATH,
  QUIZ_PATH,
  "/practice",
  "/review",
  "/simulator",
  "/tools",
  "/journal",
] as const;

type DemoState = {
  version: number;
  onboarding: Record<string, unknown> | null;
  completedLessons: string[];
  bookmarks: string[];
  lessonNotes: Record<string, string>;
  quizScores: Record<string, number>;
  reviewCards: Record<string, unknown>;
  journalEntries: Array<Record<string, unknown>>;
  simulatorSummary: Record<string, unknown> | null;
};

type LayoutMeasurement = {
  clientWidth: number;
  scrollWidth: number;
  overflow: number;
  offenders: string[];
};

async function installDeterministicDemo(page: Page, language = "en") {
  await page.addInitScript(
    ({ demoKey, demoState, languageKey, languageValue, themeKey }) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem(demoKey, JSON.stringify(demoState));
      window.localStorage.setItem(languageKey, languageValue);
      window.localStorage.setItem(themeKey, "light");
    },
    {
      demoKey: DEMO_STORAGE_KEY,
      demoState: EMPTY_DEMO_STATE,
      languageKey: LANGUAGE_STORAGE_KEY,
      languageValue: language,
      themeKey: THEME_STORAGE_KEY,
    },
  );

  // Public Academy queries intentionally exercise the app's local demo fallback.
  // A successful empty response avoids requiring a backend and avoids browser
  // network errors that could hide genuine console regressions.
  await page.route("**/api/v1/**", async (route) => {
    await route.fulfill({
      status: 204,
      headers: {
        "access-control-allow-headers": "authorization,content-type",
        "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
        "access-control-allow-origin": "*",
      },
    });
  });
}

async function openRoute(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(
    response,
    `Navigation to ${path} did not produce a document response`,
  ).not.toBeNull();
  expect(response?.status(), `${path} returned an HTTP error`).toBeLessThan(
    400,
  );
  await expect(
    page.locator("main").first(),
    `${path} has no visible main landmark`,
  ).toBeVisible();
}

async function readDemoState(page: Page): Promise<DemoState> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) throw new Error(`Missing deterministic demo state at ${key}`);
    return JSON.parse(raw) as DemoState;
  }, DEMO_STORAGE_KEY);
}

async function measureLayout(page: Page): Promise<LayoutMeasurement> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const clientWidth = root.clientWidth;
    const scrollWidth = Math.max(root.scrollWidth, document.body.scrollWidth);
    const offenders = Array.from(
      document.body.querySelectorAll<HTMLElement>("*"),
    )
      .filter((element) => {
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden")
          return false;
        const rect = element.getBoundingClientRect();
        return (
          rect.width > 1 && (rect.right > clientWidth + 1 || rect.left < -1)
        );
      })
      .slice(0, 8)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const identity = element.id
          ? `#${element.id}`
          : `${element.tagName.toLowerCase()}${element.classList.length ? `.${Array.from(element.classList).slice(0, 2).join(".")}` : ""}`;
        return `${identity} [${rect.left.toFixed(1)}, ${rect.right.toFixed(1)}]`;
      });
    return {
      clientWidth,
      scrollWidth,
      overflow: scrollWidth - clientWidth,
      offenders,
    };
  });
}

function formatAxeViolations(route: string, results: AxeResults): string[] {
  return results.violations.map((violation) => {
    const targets = violation.nodes
      .slice(0, 3)
      .flatMap((node) => node.target)
      .map(String)
      .join(", ");
    return `${route}: ${violation.id} (${violation.impact ?? "unknown"}) ${violation.help} [${targets}]`;
  });
}

test.describe("Borza Academy required journeys", () => {
  test("01 visitor opens the landing page", async ({ page }) => {
    await installDeterministicDemo(page);
    await openRoute(page, "/");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Learn finance. Practise trading. Build real market skills.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Start learning" }),
    ).toHaveAttribute("href", "/onboarding");
    await expect(
      page.getByRole("link", { name: "Try the simulator" }),
    ).toHaveAttribute("href", "/simulator");
    await expect(page.locator(`a[href="${LESSON_PATH}"]`)).toBeVisible();
    await expect(
      page.getByText("Education and simulation only.", { exact: false }),
    ).toBeVisible();
  });

  test("02 visitor starts the complete demo lesson", async ({ page }) => {
    await installDeterministicDemo(page);
    await openRoute(page, "/");
    await page.locator(`a[href="${LESSON_PATH}"]`).click();

    await expect(page).toHaveURL(new RegExp(`${LESSON_PATH}$`));
    await expect(
      page.getByRole("heading", {
        name: "How financial markets connect capital",
        exact: true,
      }),
    ).toBeVisible();
    for (const section of [
      "What you will learn",
      "Core explanation",
      "Visual example",
      "Interactive exercise",
      "Worked example",
      "Common mistake",
      "Practical takeaway",
      "Knowledge check",
      "Review cards",
      "Sources and further reading",
    ]) {
      await expect(
        page.getByRole("heading", { name: section, exact: true }),
      ).toBeVisible();
    }
    await expect(
      page.getByRole("figure", { name: /Deterministic simulated data/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Complete lesson" }),
    ).toBeEnabled();
  });

  test("03 visitor completes a quiz and receives explanatory feedback", async ({
    page,
  }) => {
    await installDeterministicDemo(page);
    await openRoute(page, QUIZ_PATH);

    await expect(
      page
        .getByRole("heading", { name: "Knowledge check", exact: true })
        .last(),
    ).toBeVisible();
    await page.getByRole("radio", { name: "The issuing company" }).check();
    await page
      .getByRole("radio", { name: "Easier risk transfer and price discovery" })
      .check();
    await page
      .getByRole("radio", { name: "The ownership claim changes hands" })
      .check();

    const submit = page.getByRole("button", { name: "Check answer" });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByText("3 / 3", { exact: true })).toBeVisible();
    await expect(page.getByText("Correct", { exact: true })).toHaveCount(3);
    await expect(
      page.getByText("Why:", { exact: false }).first(),
    ).toBeVisible();
    const state = await readDemoState(page);
    expect(state.quizScores["lesson-ff-finance-map"]).toBe(100);
  });

  test("04 visitor runs a deterministic simulator scenario", async ({
    page,
  }) => {
    test.slow();
    await installDeterministicDemo(page);
    await openRoute(page, "/simulator");

    await expect(
      page
        .getByRole("heading", { name: "Learning simulator", exact: true })
        .last(),
    ).toBeVisible();
    await expect(
      page.getByText("Paper trading only. No real order is ever transmitted.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Step", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Bracket", exact: true }).click();
    await page.getByLabel("Position size").fill("10");
    await page.getByLabel("Risk per trade (%)").fill("0.5");
    await page.getByLabel("Stop").fill("95");
    await page.getByLabel("Take profit").fill("120");
    await page.getByRole("button", { name: "Place simulated order" }).click();
    await expect(
      page.getByRole("button", { name: "Close position" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Step", exact: true }).click();
    await page.getByRole("button", { name: "Review scenario" }).click();

    await expect(page).toHaveURL(/\/simulator\/results$/);
    await expect(
      page
        .getByRole("heading", { name: "Review scenario", exact: true })
        .last(),
    ).toBeVisible();
    await expect(page.getByText(/Process quality: \d+%/)).toBeVisible();
    const state = await readDemoState(page);
    expect(state.simulatorSummary).toMatchObject({ trades: 1 });
  });

  test("05 user completes onboarding and receives a learning plan", async ({
    page,
  }) => {
    await installDeterministicDemo(page);
    await openRoute(page, "/onboarding");

    await expect(
      page.getByRole("heading", { name: "Your learning plan", exact: true }),
    ).toBeVisible();
    for (let step = 0; step < 8; step += 1) {
      await page.getByRole("radio").first().check();
      const action = page.getByRole("button", {
        name: step === 7 ? "Save plan and begin" : "Next",
        exact: true,
      });
      await expect(action).toBeEnabled();
      await action.click();
    }

    await expect(page).toHaveURL(/\/home$/);
    await expect(
      page.getByRole("heading", { name: "Welcome back", exact: true }).last(),
    ).toBeVisible();
    const state = await readDemoState(page);
    expect(state.onboarding).toMatchObject({
      goal: "Understand finance from zero",
      recommendation: "path-finance-foundations",
    });
  });

  test("06 user resumes the recommended lesson from home", async ({ page }) => {
    await installDeterministicDemo(page);
    await openRoute(page, "/home");

    const continueLink = page.locator(`a[href="${LESSON_PATH}"]`);
    await expect(continueLink).toBeVisible();
    await expect(continueLink).toContainText("Continue");
    await continueLink.click();

    await expect(page).toHaveURL(new RegExp(`${LESSON_PATH}$`));
    await expect(page.getByText("42%", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Core explanation", exact: true }),
    ).toBeVisible();
  });

  test("07 user completes the daily FSRS review queue", async ({ page }) => {
    test.slow();
    await installDeterministicDemo(page);
    await openRoute(page, "/review");

    await expect(
      page.getByRole("heading", { name: "Daily review", exact: true }).last(),
    ).toBeVisible();
    for (let card = 0; card < 4; card += 1) {
      const reveal = page.getByRole("button", {
        name: "Reveal answer",
        exact: true,
      });
      await expect(
        reveal,
        `Review card ${card + 1} is missing its reveal control`,
      ).toBeVisible();
      await reveal.click();
      const good = page.getByRole("button", { name: "Good", exact: true });
      await expect(
        good,
        `Review card ${card + 1} is missing its Good grade`,
      ).toBeEnabled();
      await good.click();
    }

    await expect(
      page.getByRole("heading", { name: "Review complete", exact: true }),
    ).toBeVisible();
    const state = await readDemoState(page);
    expect(Object.keys(state.reviewCards)).toHaveLength(4);
  });

  test("08 user calculates a position size from account risk", async ({
    page,
  }) => {
    await installDeterministicDemo(page);
    await openRoute(page, "/tools");

    await expect(
      page.getByRole("heading", { name: "Finance tools", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Position size calculator/i }),
    ).toBeVisible();
    await page.getByLabel("Account balance").fill("10000");
    await page.getByLabel("Risk per trade (%)").fill("1");
    await page.getByLabel("Entry price").fill("100");
    await page.getByLabel("Stop price").fill("98");
    await page.getByRole("button", { name: "Calculate", exact: true }).click();

    const result = page.getByRole("status", { name: /Position size result/i });
    await expect(result).toBeVisible();
    await expect(result).toContainText(/50(?:\.00)?/);
    await expect(page.getByText("Formula", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Common mistake", { exact: true }),
    ).toBeVisible();
  });

  test("09 user records a structured journal entry", async ({ page }) => {
    await installDeterministicDemo(page);
    await openRoute(page, "/journal");

    await expect(
      page
        .getByRole("heading", { name: "Trading journal", exact: true })
        .last(),
    ).toBeVisible();
    await page.getByLabel("Setup").fill("Trend pullback");
    await page
      .getByLabel("Thesis")
      .fill("Higher lows support a continuation hypothesis.");
    await page
      .getByLabel("Market context")
      .fill("Liquid simulated index during the regular session.");
    await page.getByLabel("Entry").fill("101");
    await page.getByLabel("Stop").fill("99");
    await page.getByLabel("Target").fill("105");
    await page.getByLabel("Planned risk").fill("100");
    await page.getByLabel("Result in R").fill("1.5");
    await page.getByLabel("Emotion before entry").fill("Calm");
    await page.getByLabel("Emotion after exit").fill("Focused");
    await page.getByRole("checkbox", { name: "Rules followed" }).check();
    await page
      .getByLabel("Lesson learned")
      .fill("Wait for confirmation and keep risk fixed.");
    await page.getByLabel("Tags").fill("pullback, disciplined");
    await page.getByRole("button", { name: "Save entry", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: "Saved entries", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Trend pullback", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Wait for confirmation and keep risk fixed.", {
        exact: true,
      }),
    ).toBeVisible();
    const state = await readDemoState(page);
    expect(state.journalEntries).toHaveLength(1);
    expect(state.journalEntries[0]).toMatchObject({
      setup: "Trend pullback",
      followedRules: true,
    });
  });

  test("10 user switches German, Slovenian, and English", async ({ page }) => {
    await installDeterministicDemo(page, "de");
    await openRoute(page, "/");

    const switcher = page.getByLabel("Language / Sprache / Jezik");
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Finanzen verstehen. Trading üben. Marktfähigkeiten aufbauen.",
      }),
    ).toBeVisible();

    await switcher.selectOption("sl");
    await expect(page.locator("html")).toHaveAttribute("lang", "sl");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Razumi finance. Vadi trgovanje. Zgradi resnične tržne veščine.",
      }),
    ).toBeVisible();

    await switcher.selectOption("en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Learn finance. Practise trading. Build real market skills.",
      }),
    ).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("11 mobile bottom navigation and More menu work", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-chromium",
      "Mobile-only navigation contract",
    );
    await installDeterministicDemo(page);
    await openRoute(page, "/home");

    const navigation = page.getByRole("navigation", {
      name: "Mobile primary navigation",
    });
    await expect(navigation).toBeVisible();
    await navigation.getByRole("link", { name: "Learn", exact: true }).click();
    await expect(page).toHaveURL(/\/learn$/);

    await navigation.getByRole("button", { name: "More", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "More", exact: true });
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("link", { name: "Finance Tools", exact: true })
      .click();
    await expect(page).toHaveURL(/\/tools$/);
    await expect(
      page.getByRole("heading", { name: "Finance tools", exact: true }),
    ).toBeVisible();
  });

  test("12 every main route is reachable without horizontal overflow", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await installDeterministicDemo(page);
    const failures: string[] = [];

    for (const route of MAIN_ROUTES) {
      const response = await page.goto(route, {
        waitUntil: "domcontentloaded",
      });
      if (!response || response.status() >= 400) {
        failures.push(`${route}: HTTP ${response?.status() ?? "no response"}`);
        continue;
      }
      await expect(page.locator("main").first()).toBeVisible();
      const measurement = await measureLayout(page);
      if (measurement.overflow > 1) {
        failures.push(
          `${route}: ${measurement.overflow}px overflow (${measurement.scrollWidth}/${measurement.clientWidth}); ${measurement.offenders.join("; ")}`,
        );
      }
    }

    expect(
      failures,
      `Main-route layout failures:\n${failures.join("\n")}`,
    ).toEqual([]);
  });

  test("13 primary pages emit no browser console or page errors", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await installDeterministicDemo(page);
    let activeRoute = "before navigation";
    const failures: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error")
        failures.push(`${activeRoute}: console: ${message.text()}`);
    });
    page.on("pageerror", (error) =>
      failures.push(`${activeRoute}: pageerror: ${error.message}`),
    );

    for (const route of PRIMARY_ROUTES) {
      activeRoute = route;
      const response = await page.goto(route, {
        waitUntil: "domcontentloaded",
      });
      if (!response || response.status() >= 400) {
        failures.push(`${route}: HTTP ${response?.status() ?? "no response"}`);
        continue;
      }
      await expect(page.locator("main").first()).toBeVisible();
      await page.waitForTimeout(150);
    }

    expect(
      failures,
      `Primary-page browser errors:\n${failures.join("\n")}`,
    ).toEqual([]);
  });

  test("14 lesson progress survives a full refresh", async ({ page }) => {
    await installDeterministicDemo(page);
    await openRoute(page, LESSON_PATH);

    const complete = page.getByRole("button", {
      name: "Complete lesson",
      exact: true,
    });
    await expect(complete).toBeEnabled();
    await complete.click();
    await expect(page.getByText("100%", { exact: true }).first()).toBeVisible();
    expect((await readDemoState(page)).completedLessons).toContain(
      "lesson-ff-finance-map",
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("100%", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Complete", exact: true }),
    ).toBeDisabled();
    expect((await readDemoState(page)).completedLessons).toContain(
      "lesson-ff-finance-map",
    );
  });

  test("core routes pass automated WCAG and best-practice scans", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await installDeterministicDemo(page);
    const failures: string[] = [];

    for (const route of ACCESSIBILITY_ROUTES) {
      await openRoute(page, route);
      await page.addScriptTag({ content: axe.source });
      const results = await page.evaluate(async () =>
        window.axe.run(document, {
          runOnly: {
            type: "tag",
            values: [
              "wcag2a",
              "wcag2aa",
              "wcag21a",
              "wcag21aa",
              "wcag22a",
              "wcag22aa",
              "best-practice",
            ],
          },
        }),
      );
      failures.push(...formatAxeViolations(route, results));
    }

    expect(
      failures,
      `Accessibility violations:\n${failures.join("\n")}`,
    ).toEqual([]);
  });
});
