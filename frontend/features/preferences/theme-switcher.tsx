"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useId } from "react";
import { usePreferences } from "./preferences-provider";
import type { ThemePreference } from "./preferences";

const options: ReadonlyArray<{
  value: ThemePreference;
  label: string;
  icon: LucideIcon;
}> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function ThemeSwitcher() {
  const name = useId();
  const { themePreference, setThemePreference } = usePreferences();

  return (
    <fieldset aria-label="Theme preference">
      <legend className="sr-only">Theme preference</legend>
      <div className="inline-grid grid-cols-3 gap-1 rounded-lg border border-[var(--line)] bg-[var(--panel-soft)] p-1">
        {options.map(({ value, label, icon: Icon }) => (
          <label key={value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={value}
              checked={themePreference === value}
              onChange={() => setThemePreference(value)}
              className="peer sr-only"
            />
            <span className="flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-md px-3 text-xs font-medium text-[var(--muted)] transition-colors peer-checked:bg-[var(--panel)] peer-checked:text-[var(--foreground)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]">
              <Icon aria-hidden="true" size={15} />
              <span>{label}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
