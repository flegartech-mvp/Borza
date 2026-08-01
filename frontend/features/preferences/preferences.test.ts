// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PREFERENCE_BOOTSTRAP_SCRIPT } from "./preference-bootstrap";
import {
  applyPreferenceAttributes,
  densityForExperience,
  parseExperienceMode,
  parseThemePreference,
  resolveThemePreference,
} from "./preferences";

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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetRoot();
});

describe("preference parsing and attributes", () => {
  it("accepts only supported public values and falls back safely", () => {
    expect(parseThemePreference("system")).toBe("system");
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("sepia")).toBe("system");
    expect(parseThemePreference(null)).toBe("system");

    expect(parseExperienceMode("beginner")).toBe("beginner");
    expect(parseExperienceMode("expert")).toBe("expert");
    expect(parseExperienceMode("student")).toBe("beginner");
    expect(parseExperienceMode(undefined)).toBe("beginner");
  });

  it("resolves system themes and maps experience modes to density", () => {
    expect(resolveThemePreference("system", true)).toBe("dark");
    expect(resolveThemePreference("system", false)).toBe("light");
    expect(resolveThemePreference("light", true)).toBe("light");
    expect(resolveThemePreference("dark", false)).toBe("dark");
    expect(densityForExperience("beginner")).toBe("comfortable");
    expect(densityForExperience("expert")).toBe("compact");
  });

  it("applies the complete HTML preference contract", () => {
    applyPreferenceAttributes(
      document.documentElement,
      "dark",
      "dark",
      "expert",
    );

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveAttribute(
      "data-theme-preference",
      "dark",
    );
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).toHaveAttribute(
      "data-experience-mode",
      "expert",
    );
    expect(document.documentElement).toHaveAttribute("data-density", "compact");
  });
});

describe("pre-hydration bootstrap", () => {
  it("hydrates valid stored preferences before the provider mounts", () => {
    window.localStorage.setItem("borza-theme", "dark");
    window.localStorage.setItem("borza-experience-mode", "expert");
    vi.stubGlobal("matchMedia", vi.fn());

    window.eval(PREFERENCE_BOOTSTRAP_SCRIPT);

    expect(document.documentElement.dataset.themePreference).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.dataset.experienceMode).toBe("expert");
    expect(document.documentElement.dataset.density).toBe("compact");
  });

  it("honors the system color scheme", () => {
    window.localStorage.setItem("borza-theme", "system");
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));

    window.eval(PREFERENCE_BOOTSTRAP_SCRIPT);

    expect(document.documentElement.dataset.themePreference).toBe("system");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
  });

  it("never throws when storage and matchMedia fail and uses safe defaults", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => {
        throw new Error("Media query unavailable");
      }),
    );

    expect(() => window.eval(PREFERENCE_BOOTSTRAP_SCRIPT)).not.toThrow();
    expect(document.documentElement.dataset.themePreference).toBe("system");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.dataset.experienceMode).toBe("beginner");
    expect(document.documentElement.dataset.density).toBe("comfortable");
  });

  it("rejects invalid stored values", () => {
    window.localStorage.setItem("borza-theme", "neon");
    window.localStorage.setItem("borza-experience-mode", "student");
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));

    window.eval(PREFERENCE_BOOTSTRAP_SCRIPT);

    expect(document.documentElement.dataset.themePreference).toBe("system");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.experienceMode).toBe("beginner");
    expect(document.documentElement.dataset.density).toBe("comfortable");
  });
});
