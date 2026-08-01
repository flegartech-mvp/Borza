"use client";

import { BookOpen, Gauge, type LucideIcon } from "lucide-react";
import { useId } from "react";
import { usePreferences } from "./preferences-provider";
import type { ExperienceMode } from "./preferences";

const options: ReadonlyArray<{
  value: ExperienceMode;
  label: string;
  icon: LucideIcon;
}> = [
  { value: "beginner", label: "Beginner", icon: BookOpen },
  { value: "expert", label: "Expert", icon: Gauge },
];

export function ExperienceSwitcher() {
  const name = useId();
  const { experienceMode, setExperienceMode } = usePreferences();

  return (
    <fieldset aria-label="Experience mode">
      <legend className="sr-only">Experience mode</legend>
      <div className="inline-grid grid-cols-2 gap-1 rounded-lg border border-[var(--line)] bg-[var(--panel-soft)] p-1">
        {options.map(({ value, label, icon: Icon }) => (
          <label key={value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={value}
              checked={experienceMode === value}
              onChange={() => setExperienceMode(value)}
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
