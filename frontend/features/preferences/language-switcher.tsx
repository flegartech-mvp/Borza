"use client";

import { Languages } from "lucide-react";
import {
  dictionaries,
  SUPPORTED_LANGUAGES,
  type Language,
} from "@/i18n/dictionaries";
import { usePreferences } from "./preferences-provider";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = usePreferences();
  return (
    <label className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2 text-sm">
      <Languages aria-hidden="true" size={16} className="text-[var(--brand)]" />
      <span className="sr-only">Language / Sprache / Jezik</span>
      <select
        aria-label="Language / Sprache / Jezik"
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        className="min-h-9 bg-transparent text-[var(--text-primary)] outline-none"
      >
        {SUPPORTED_LANGUAGES.map((value) => (
          <option key={value} value={value}>
            {compact ? value.toUpperCase() : dictionaries[value].languageName}
          </option>
        ))}
      </select>
    </label>
  );
}
