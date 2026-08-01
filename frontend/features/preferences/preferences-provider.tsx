"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  applyPreferenceAttributes,
  DEFAULT_EXPERIENCE_MODE,
  DEFAULT_THEME_PREFERENCE,
  densityForExperience,
  EXPERIENCE_MODE_STORAGE_KEY,
  isExperienceMode,
  isThemePreference,
  parseExperienceMode,
  parseThemePreference,
  resolveThemePreference,
  THEME_STORAGE_KEY,
  type ExperienceDensity,
  type ExperienceMode,
  type ResolvedTheme,
  type ThemePreference,
} from "./preferences";

type PreferencesContextValue = {
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setThemePreference: (preference: ThemePreference) => void;
  experienceMode: ExperienceMode;
  density: ExperienceDensity;
  setExperienceMode: (mode: ExperienceMode) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function safeStorageRead(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageWrite(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Preferences are optional; a privacy setting may block local storage.
  }
}

function getSystemThemeQuery(): MediaQueryList | null {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return null;
  }
  try {
    return window.matchMedia("(prefers-color-scheme: dark)");
  } catch {
    return null;
  }
}

function readSystemPrefersDark(): boolean {
  try {
    return getSystemThemeQuery()?.matches === true;
  } catch {
    return false;
  }
}

function readBootstrappedTheme(root: HTMLElement): ThemePreference {
  const attribute = root.dataset.themePreference;
  return isThemePreference(attribute)
    ? attribute
    : parseThemePreference(safeStorageRead(THEME_STORAGE_KEY));
}

function readBootstrappedExperience(root: HTMLElement): ExperienceMode {
  const attribute = root.dataset.experienceMode;
  return isExperienceMode(attribute)
    ? attribute
    : parseExperienceMode(safeStorageRead(EXPERIENCE_MODE_STORAGE_KEY));
}

function noopSubscribe(): () => void {
  return () => undefined;
}

function subscribeToSystemTheme(onStoreChange: () => void): () => void {
  const systemQuery = getSystemThemeQuery();
  if (!systemQuery) return noopSubscribe();

  try {
    systemQuery.addEventListener("change", onStoreChange);
    return () => {
      try {
        systemQuery.removeEventListener("change", onStoreChange);
      } catch {
        // A partial matchMedia implementation may not support cleanup.
      }
    };
  } catch {
    try {
      systemQuery.addListener(onStoreChange);
      return () => {
        try {
          systemQuery.removeListener(onStoreChange);
        } catch {
          // A legacy matchMedia implementation may not support cleanup.
        }
      };
    } catch {
      return noopSubscribe();
    }
  }
}

function useHasHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const hasHydrated = useHasHydrated();
  const bootstrappedTheme = useSyncExternalStore(
    noopSubscribe,
    () => readBootstrappedTheme(document.documentElement),
    () => DEFAULT_THEME_PREFERENCE,
  );
  const bootstrappedExperience = useSyncExternalStore(
    noopSubscribe,
    () => readBootstrappedExperience(document.documentElement),
    () => DEFAULT_EXPERIENCE_MODE,
  );
  const systemPrefersDark = useSyncExternalStore(
    subscribeToSystemTheme,
    readSystemPrefersDark,
    () => false,
  );
  const [themeOverride, setThemeOverride] = useState<ThemePreference | null>(
    null,
  );
  const [experienceOverride, setExperienceOverride] =
    useState<ExperienceMode | null>(null);
  const themePreference = themeOverride ?? bootstrappedTheme;
  const experienceMode = experienceOverride ?? bootstrappedExperience;

  const resolvedTheme = resolveThemePreference(
    themePreference,
    systemPrefersDark,
  );
  const density = densityForExperience(experienceMode);

  useEffect(() => {
    if (!hasHydrated) return;
    applyPreferenceAttributes(
      document.documentElement,
      themePreference,
      resolvedTheme,
      experienceMode,
    );
    safeStorageWrite(THEME_STORAGE_KEY, themePreference);
    safeStorageWrite(EXPERIENCE_MODE_STORAGE_KEY, experienceMode);
  }, [experienceMode, hasHydrated, resolvedTheme, themePreference]);

  const setThemePreference = useCallback((preference: ThemePreference) => {
    setThemeOverride(parseThemePreference(preference));
  }, []);

  const setExperienceMode = useCallback((mode: ExperienceMode) => {
    setExperienceOverride(parseExperienceMode(mode));
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      themePreference,
      resolvedTheme,
      setThemePreference,
      experienceMode,
      density,
      setExperienceMode,
    }),
    [
      density,
      experienceMode,
      resolvedTheme,
      setExperienceMode,
      setThemePreference,
      themePreference,
    ],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const preferences = useContext(PreferencesContext);
  if (!preferences) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return preferences;
}
