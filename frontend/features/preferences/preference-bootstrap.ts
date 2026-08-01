import {
  DEFAULT_EXPERIENCE_MODE,
  DEFAULT_THEME_PREFERENCE,
  EXPERIENCE_MODE_STORAGE_KEY,
  EXPERIENCE_MODES,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
} from "./preferences";

export const PREFERENCE_BOOTSTRAP_SCRIPT = `(() => {
  const root = document.documentElement;
  const read = (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const themes = ${JSON.stringify(THEME_PREFERENCES)};
  const modes = ${JSON.stringify(EXPERIENCE_MODES)};
  const storedTheme = read(${JSON.stringify(THEME_STORAGE_KEY)});
  const themePreference = themes.includes(storedTheme)
    ? storedTheme
    : ${JSON.stringify(DEFAULT_THEME_PREFERENCE)};
  let systemPrefersDark = false;
  if (themePreference === "system") {
    try {
      systemPrefersDark =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches === true;
    } catch {
      systemPrefersDark = false;
    }
  }
  const resolvedTheme =
    themePreference === "dark" ||
    (themePreference === "system" && systemPrefersDark)
      ? "dark"
      : "light";
  const storedMode = read(${JSON.stringify(EXPERIENCE_MODE_STORAGE_KEY)});
  const experienceMode = modes.includes(storedMode)
    ? storedMode
    : ${JSON.stringify(DEFAULT_EXPERIENCE_MODE)};

  root.dataset.theme = resolvedTheme;
  root.dataset.themePreference = themePreference;
  root.classList.toggle("dark", resolvedTheme === "dark");
  root.dataset.experienceMode = experienceMode;
  root.dataset.density =
    experienceMode === "expert" ? "compact" : "comfortable";
})();`;
