"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { dictionaries, type AcademyDictionary, type Language } from "@/i18n/dictionaries";
import {
  applyPreferences,
  DEFAULT_LANGUAGE,
  DEFAULT_THEME_PREFERENCE,
  LANGUAGE_STORAGE_KEY,
  parseLanguage,
  parseThemePreference,
  resolveThemePreference,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "./preferences";

type PreferencesContextValue = {
  language: Language;
  dictionary: AcademyDictionary;
  setLanguage: (language: Language) => void;
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setThemePreference: (theme: ThemePreference) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function safeRead(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The application remains usable when storage is unavailable.
  }
}

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [themePreference, setThemeState] = useState<ThemePreference>(
    DEFAULT_THEME_PREFERENCE,
  );
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const hydrateFromBootstrap = () => {
      setLanguageState(parseLanguage(document.documentElement.lang || safeRead(LANGUAGE_STORAGE_KEY)));
      setThemeState(parseThemePreference(document.documentElement.dataset.themePreference ?? safeRead(THEME_STORAGE_KEY)));
      setSystemDark(systemPrefersDark());
    };
    const frame = window.requestAnimationFrame(hydrateFromBootstrap);
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query?.addEventListener?.("change", handleChange);
    return () => {
      window.cancelAnimationFrame(frame);
      query?.removeEventListener?.("change", handleChange);
    };
  }, []);

  const resolvedTheme = resolveThemePreference(themePreference, systemDark);

  useEffect(() => {
    applyPreferences(document.documentElement, themePreference, resolvedTheme, language);
    safeWrite(THEME_STORAGE_KEY, themePreference);
    safeWrite(LANGUAGE_STORAGE_KEY, language);
  }, [language, resolvedTheme, themePreference]);

  const setLanguage = useCallback((value: Language) => {
    setLanguageState(parseLanguage(value));
  }, []);
  const setThemePreference = useCallback((value: ThemePreference) => {
    setThemeState(parseThemePreference(value));
  }, []);
  const value = useMemo<PreferencesContextValue>(
    () => ({
      language,
      dictionary: dictionaries[language],
      setLanguage,
      themePreference,
      resolvedTheme,
      setThemePreference,
    }),
    [language, resolvedTheme, setLanguage, setThemePreference, themePreference],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used inside PreferencesProvider");
  return context;
}
