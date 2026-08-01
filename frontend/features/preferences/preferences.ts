export const THEME_STORAGE_KEY = "borza-theme";
export const EXPERIENCE_MODE_STORAGE_KEY = "borza-experience-mode";

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const EXPERIENCE_MODES = ["beginner", "expert"] as const;
export type ExperienceMode = (typeof EXPERIENCE_MODES)[number];

export type ResolvedTheme = Exclude<ThemePreference, "system">;
export type ExperienceDensity = "comfortable" | "compact";

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";
export const DEFAULT_EXPERIENCE_MODE: ExperienceMode = "beginner";

export function isThemePreference(value: unknown): value is ThemePreference {
  return (
    typeof value === "string" &&
    THEME_PREFERENCES.some((preference) => preference === value)
  );
}

export function parseThemePreference(value: unknown): ThemePreference {
  return isThemePreference(value) ? value : DEFAULT_THEME_PREFERENCE;
}

export function isExperienceMode(value: unknown): value is ExperienceMode {
  return (
    typeof value === "string" && EXPERIENCE_MODES.some((mode) => mode === value)
  );
}

export function parseExperienceMode(value: unknown): ExperienceMode {
  return isExperienceMode(value) ? value : DEFAULT_EXPERIENCE_MODE;
}

export function resolveThemePreference(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  return preference === "system"
    ? systemPrefersDark
      ? "dark"
      : "light"
    : preference;
}

export function densityForExperience(mode: ExperienceMode): ExperienceDensity {
  return mode === "expert" ? "compact" : "comfortable";
}

export function applyPreferenceAttributes(
  root: HTMLElement,
  themePreference: ThemePreference,
  resolvedTheme: ResolvedTheme,
  experienceMode: ExperienceMode,
): void {
  root.dataset.theme = resolvedTheme;
  root.dataset.themePreference = themePreference;
  root.classList.toggle("dark", resolvedTheme === "dark");
  root.dataset.experienceMode = experienceMode;
  root.dataset.density = densityForExperience(experienceMode);
}
