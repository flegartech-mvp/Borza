"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Clock3, Languages, Palette } from "lucide-react";
import { PageHeading } from "@/components/academy/page-heading";
import { Button } from "@/components/ui/button";
import { useDemoWorkspace } from "@/features/demo/demo-workspace-provider";
import { LanguageSwitcher, ThemeSwitcher, usePreferences } from "@/features/preferences";
import { academyApi } from "@/lib/api-client";

type PreferenceRead = { theme: "light" | "dark" | "system"; weekly_study_minutes: number; reduced_motion: boolean; email_reminders: boolean };
const copy = { de: { language: "Lernsprache", appearance: "Darstellung", weekly: "Wöchentliche Lernzeit in Minuten", motion: "Bewegung reduzieren", reminders: "E-Mail-Erinnerungen", saved: "Einstellungen gespeichert.", demo: "Sprache und Darstellung werden in diesem Browser gespeichert." }, sl: { language: "Jezik učenja", appearance: "Videz", weekly: "Tedenski čas učenja v minutah", motion: "Zmanjšaj gibanje", reminders: "E-poštni opomniki", saved: "Nastavitve so shranjene.", demo: "Jezik in videz se shranita v tem brskalniku." }, en: { language: "Learning language", appearance: "Appearance", weekly: "Weekly study minutes", motion: "Reduce motion", reminders: "Email reminders", saved: "Settings saved.", demo: "Language and appearance are saved in this browser." } };

export function SettingsPage() {
  const { dictionary, language, themePreference } = usePreferences();
  const { mode } = useDemoWorkspace();
  const queryClient = useQueryClient();
  const strings = copy[language];
  const query = useQuery({ queryKey: ["academy", "preferences"], queryFn: () => academyApi<PreferenceRead>("/preferences"), enabled: mode === "authenticated", retry: 1 });
  const [weeklyOverride, setWeekly] = useState<number | null>(null);
  const [motionOverride, setMotion] = useState<boolean | null>(null);
  const [reminderOverride, setReminder] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const weekly = weeklyOverride ?? query.data?.weekly_study_minutes ?? 180;
  const reducedMotion = motionOverride ?? query.data?.reduced_motion ?? false;
  const reminders = reminderOverride ?? query.data?.email_reminders ?? false;
  const save = async () => {
    setStatus(null);
    try {
      if (mode === "authenticated") {
        await academyApi("/preferences", { method: "PUT", body: { theme: themePreference, weekly_study_minutes: weekly, reduced_motion: reducedMotion, email_reminders: reminders } });
        await queryClient.invalidateQueries({ queryKey: ["academy", "preferences"] });
      }
      document.documentElement.dataset.reduceMotion = reducedMotion ? "true" : "false";
      setStatus(strings.saved);
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : dictionary.auth.error); }
  };
  return <><PageHeading eyebrow={dictionary.brand.name} title={dictionary.secondary.settingsTitle} description={dictionary.secondary.settingsIntro} /><section className="mx-auto max-w-3xl space-y-4"><Setting icon={Languages} title={strings.language}><LanguageSwitcher /></Setting><Setting icon={Palette} title={strings.appearance}><ThemeSwitcher /></Setting><Setting icon={Clock3} title={strings.weekly}><input aria-label={strings.weekly} type="number" min={15} max={2400} step={15} value={weekly} onChange={(event) => setWeekly(Number(event.target.value))} className="numeric min-h-11 w-36 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3" /></Setting><Setting icon={Bell} title={strings.motion}><label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={reducedMotion} onChange={(event) => setMotion(event.target.checked)} className="size-5" />{strings.motion}</label></Setting><Setting icon={Bell} title={strings.reminders}><label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={reminders} disabled={mode === "demo"} onChange={(event) => setReminder(event.target.checked)} className="size-5" />{strings.reminders}</label></Setting>{mode === "demo" ? <p className="text-sm text-[var(--text-secondary)]">{strings.demo}</p> : null}{status ? <p role="status" className="text-sm text-[var(--brand)]">{status}</p> : null}<Button onClick={() => void save()} disabled={weekly < 15 || weekly > 2400}>{dictionary.common.save}</Button></section></>;
}

function Setting({ icon: Icon, title, children }: { icon: typeof Languages; title: string; children: React.ReactNode }) { return <article className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 sm:flex-row sm:items-center sm:justify-between"><h2 className="flex items-center gap-2 font-semibold"><Icon aria-hidden="true" size={17} className="text-[var(--brand)]" />{title}</h2>{children}</article>; }
