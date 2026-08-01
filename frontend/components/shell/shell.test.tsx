// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PreferencesProvider } from "@/features/preferences";
import { PRIMARY_NAVIGATION } from "@/lib/navigation";
import { AppShell } from "./app-shell";

const navigationState = vi.hoisted(() => ({ pathname: "/news" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...original,
    getIngestionStatus: vi.fn().mockResolvedValue({
      status: "complete",
      provider: "demo",
      worker_status: "ready",
      last_started_at: "2026-07-29T10:00:00Z",
      last_completed_at: "2026-07-29T10:01:00Z",
      last_successful_at: "2026-07-29T10:01:00Z",
      records_inserted: 8,
    }),
  };
});

function installBrowserPrimitives() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      media: "(prefers-color-scheme: dark)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }),
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value() {
      this.open = true;
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value() {
      this.open = false;
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    },
  });
}

function renderShell() {
  return render(
    <PreferencesProvider>
      <AppShell>
        <h2>News route content</h2>
      </AppShell>
    </PreferencesProvider>,
  );
}

beforeEach(() => {
  installBrowserPrimitives();
  window.localStorage.clear();
  navigationState.pathname = "/news";
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("workspace shell", () => {
  it("provides desktop and mobile navigation with the active route", () => {
    renderShell();

    const primaryNavigation = screen.getByRole("navigation", {
      name: "Primary navigation",
    });
    expect(primaryNavigation).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Mobile primary navigation" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "News Explorer" })[0],
    ).toHaveAttribute("aria-current", "page");

    for (const item of PRIMARY_NAVIGATION) {
      expect(
        screen.getAllByRole("link", {
          name: new RegExp(item.shortLabel, "i"),
        }).length,
      ).toBeGreaterThan(0);
    }
    expect(
      screen.getByRole("link", { name: "Skip to workspace content" }),
    ).toHaveAttribute("href", "#workspace-content");
  });

  it("opens the mobile menu, supports cancel, and returns focus", async () => {
    const user = userEvent.setup();
    renderShell();
    const trigger = screen.getByRole("button", {
      name: "Open workspace menu",
    });

    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Workspace menu" });
    const close = screen.getByRole("button", {
      name: "Close workspace menu",
    });
    expect(dialog).toHaveAttribute("open");
    expect(close).toHaveFocus();

    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    await waitFor(() => expect(dialog).not.toHaveAttribute("open"));
    expect(trigger).toHaveFocus();
  });

  it("has no detectable shell accessibility violations", async () => {
    const { container } = renderShell();
    const result = await axe.run(container, {
      rules: {
        // JSDOM does not implement canvas, which axe uses for contrast checks.
        // Contrast is covered in the real-browser visual checkpoint.
        "color-contrast": { enabled: false },
      },
    });
    expect(result.violations).toEqual([]);
  }, 10_000);
});
