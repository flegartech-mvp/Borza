import { isLanguage, type Language } from "@/i18n/dictionaries";

export const THEME_STORAGE_KEY = "borza-academy-theme";
export const LANGUAGE_STORAGE_KEY = "borza-academy-language";
export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = Exclude<ThemePreference, "system">;

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";
export const DEFAULT_LANGUAGE: Language = "de";

export function isThemePreference(value: unknown): value is ThemePreference {
  return (
    typeof value === "string" &&
    THEME_PREFERENCES.some((preference) => preference === value)
  );
}

export function parseThemePreference(value: unknown): ThemePreference {
  return isThemePreference(value) ? value : DEFAULT_THEME_PREFERENCE;
}

export function parseLanguage(value: unknown): Language {
  return isLanguage(value) ? value : DEFAULT_LANGUAGE;
}

export function resolveThemePreference(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

export function applyPreferences(
  root: HTMLElement,
  themePreference: ThemePreference,
  resolvedTheme: ResolvedTheme,
  language: Language,
): void {
  root.dataset.theme = resolvedTheme;
  root.dataset.themePreference = themePreference;
  root.classList.toggle("dark", resolvedTheme === "dark");
  root.lang = language;
}
