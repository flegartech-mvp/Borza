import {
  DEFAULT_LANGUAGE,
  DEFAULT_THEME_PREFERENCE,
  LANGUAGE_STORAGE_KEY,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
} from "./preferences";
import { SUPPORTED_LANGUAGES } from "@/i18n/dictionaries";

export const PREFERENCE_BOOTSTRAP_SCRIPT = `(() => {
  const root = document.documentElement;
  const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const themes = ${JSON.stringify(THEME_PREFERENCES)};
  const languages = ${JSON.stringify(SUPPORTED_LANGUAGES)};
  const storedTheme = read(${JSON.stringify(THEME_STORAGE_KEY)});
  const theme = themes.includes(storedTheme) ? storedTheme : ${JSON.stringify(DEFAULT_THEME_PREFERENCE)};
  const prefersDark = theme === "system" && typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = theme === "dark" || prefersDark ? "dark" : "light";
  const storedLanguage = read(${JSON.stringify(LANGUAGE_STORAGE_KEY)});
  const language = languages.includes(storedLanguage) ? storedLanguage : ${JSON.stringify(DEFAULT_LANGUAGE)};
  root.dataset.theme = resolved;
  root.dataset.themePreference = theme;
  root.classList.toggle("dark", resolved === "dark");
  root.lang = language;
})();`;
