// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExperienceSwitcher } from "./experience-switcher";
import { PreferencesProvider, usePreferences } from "./preferences-provider";
import { ThemeSwitcher } from "./theme-switcher";

type MatchMediaController = {
  setMatches: (matches: boolean) => void;
};

function installMatchMedia(initialMatches: boolean): MatchMediaController {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const query = {
    media: "(prefers-color-scheme: dark)",
    get matches() {
      return matches;
    },
    onchange: null,
    addEventListener: (
      type: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => {
      if (type === "change") listeners.add(listener);
    },
    removeEventListener: (
      type: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => {
      if (type === "change") listeners.delete(listener);
    },
    addListener: (listener: (event: MediaQueryListEvent) => void) =>
      listeners.add(listener),
    removeListener: (listener: (event: MediaQueryListEvent) => void) =>
      listeners.delete(listener),
    dispatchEvent: () => true,
  } as unknown as MediaQueryList;

  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(query));

  return {
    setMatches(nextMatches) {
      matches = nextMatches;
      const event = {
        matches,
        media: query.media,
      } as MediaQueryListEvent;
      for (const listener of listeners) listener(event);
    },
  };
}

function PreferenceSnapshot() {
  const preferences = usePreferences();
  return (
    <output data-testid="preference-snapshot">
      {[
        preferences.themePreference,
        preferences.resolvedTheme,
        preferences.experienceMode,
        preferences.density,
      ].join(":")}
    </output>
  );
}

function PreferenceHarness() {
  return (
    <PreferencesProvider>
      <PreferenceSnapshot />
      <ThemeSwitcher />
      <ExperienceSwitcher />
    </PreferencesProvider>
  );
}

function resetRoot() {
  const root = document.documentElement;
  root.classList.remove("dark");
  delete root.dataset.theme;
  delete root.dataset.themePreference;
  delete root.dataset.experienceMode;
  delete root.dataset.density;
}

beforeEach(() => {
  window.localStorage.clear();
  resetRoot();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetRoot();
});

describe("PreferencesProvider", () => {
  it("tracks system theme changes and persists validated defaults", async () => {
    const media = installMatchMedia(false);
    window.localStorage.setItem("borza-theme", "system");
    window.localStorage.setItem("borza-experience-mode", "beginner");

    render(<PreferenceHarness />);

    await waitFor(() => {
      expect(screen.getByTestId("preference-snapshot")).toHaveTextContent(
        "system:light:beginner:comfortable",
      );
    });
    expect(document.documentElement.dataset.theme).toBe("light");

    act(() => media.setMatches(true));

    await waitFor(() => {
      expect(screen.getByTestId("preference-snapshot")).toHaveTextContent(
        "system:dark:beginner:comfortable",
      );
    });
    expect(document.documentElement).toHaveClass("dark");
    expect(window.localStorage.getItem("borza-theme")).toBe("system");
    expect(window.localStorage.getItem("borza-experience-mode")).toBe(
      "beginner",
    );
  });

  it("persists controls and applies expert density", async () => {
    installMatchMedia(false);
    window.localStorage.setItem("borza-theme", "light");
    window.localStorage.setItem("borza-experience-mode", "beginner");
    const user = userEvent.setup();

    render(<PreferenceHarness />);

    const themeGroup = screen.getByRole("group", {
      name: "Darstellung",
    });
    const experienceGroup = screen.getByRole("group", {
      name: "Ansichtsmodus",
    });
    expect(themeGroup).toBeInTheDocument();
    expect(experienceGroup).toBeInTheDocument();

    const dark = await screen.findByRole("radio", { name: "Dunkel" });
    const expert = screen.getByRole("radio", { name: "Kompakt" });
    await user.click(dark);
    expert.focus();
    await user.keyboard(" ");

    await waitFor(() => {
      expect(dark).toBeChecked();
      expect(expert).toBeChecked();
      expect(window.localStorage.getItem("borza-theme")).toBe("dark");
      expect(window.localStorage.getItem("borza-experience-mode")).toBe(
        "expert",
      );
    });
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.experienceMode).toBe("expert");
    expect(document.documentElement.dataset.density).toBe("compact");
    expect(dark.nextElementSibling).toHaveClass("min-h-10");
    expect(expert.nextElementSibling).toHaveClass("min-h-10");
  });

  it("falls back from invalid storage without exposing a student mode", async () => {
    installMatchMedia(false);
    window.localStorage.setItem("borza-theme", "invalid");
    window.localStorage.setItem("borza-experience-mode", "student");

    render(<PreferenceHarness />);

    await waitFor(() => {
      expect(screen.getByTestId("preference-snapshot")).toHaveTextContent(
        "system:light:beginner:comfortable",
      );
    });
    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Standard" })).toBeChecked();
    expect(screen.queryByRole("radio", { name: "Student" })).toBeNull();
  });
});
