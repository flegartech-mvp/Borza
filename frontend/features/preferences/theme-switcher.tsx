"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { usePreferences } from "./preferences-provider";
import type { ThemePreference } from "./preferences";

const options: Array<{ value: ThemePreference; icon: typeof Sun }> = [
  { value: "system", icon: Monitor },
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
];

export function ThemeSwitcher() {
  const { themePreference, setThemePreference, language } = usePreferences();
  const labels = {
    de: { system: "System", light: "Hell", dark: "Dunkel" },
    sl: { system: "Sistem", light: "Svetlo", dark: "Temno" },
    en: { system: "System", light: "Light", dark: "Dark" },
  }[language];
  return (
    <fieldset
      aria-label={
        language === "de"
          ? "Darstellung"
          : language === "sl"
            ? "Videz"
            : "Appearance"
      }
    >
      <legend className="sr-only">
        {language === "de"
          ? "Darstellung"
          : language === "sl"
            ? "Videz"
            : "Appearance"}
      </legend>
      <div className="inline-grid grid-cols-3 gap-1 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1">
        {options.map(({ value, icon: Icon }) => (
          <label key={value} className="cursor-pointer">
            <input
              type="radio"
              name="theme"
              value={value}
              checked={themePreference === value}
              onChange={() => setThemePreference(value)}
              className="peer sr-only"
            />
            <span className="flex min-h-10 items-center gap-1.5 rounded-md px-2 text-xs text-[var(--text-secondary)] peer-checked:bg-[var(--surface-1)] peer-checked:text-[var(--text-primary)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--brand)]">
              <Icon aria-hidden="true" size={14} /> {labels[value]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
