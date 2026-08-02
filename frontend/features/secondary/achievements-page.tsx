"use client";

import { useQuery } from "@tanstack/react-query";
import { Award, BookOpenCheck, Brain, LockKeyhole, NotebookPen, ShieldCheck, Target } from "lucide-react";
import { PageHeading } from "@/components/academy/page-heading";
import { useDemoWorkspace } from "@/features/demo/demo-workspace-provider";
import { usePreferences } from "@/features/preferences";
import { academyApi } from "@/lib/api-client";

type RemoteAchievement = { achievement_id: string; progress: number; awarded_at: string };
const definitions = [
  { id: "first-lesson", icon: BookOpenCheck, title: { de: "Erster Baustein", sl: "Prvi gradnik", en: "First building block" }, body: { de: "Schließe eine Lektion ab.", sl: "Dokončaj eno lekcijo.", en: "Complete one lesson." } },
  { id: "risk-plan", icon: ShieldCheck, title: { de: "Risiko zuerst", sl: "Najprej tveganje", en: "Risk first" }, body: { de: "Beende ein Szenario ohne Regelverstoß.", sl: "Dokončaj scenarij brez kršitve pravil.", en: "Finish a scenario without a rule violation." } },
  { id: "review-session", icon: Brain, title: { de: "Erinnerung gepflegt", sl: "Utrjen spomin", en: "Recall maintained" }, body: { de: "Bearbeite eine fällige Wiederholung.", sl: "Dokončaj zapadlo ponovitev.", en: "Complete one due review." } },
  { id: "honest-journal", icon: NotebookPen, title: { de: "Ehrlich reflektiert", sl: "Iskren razmislek", en: "Honest reflection" }, body: { de: "Speichere einen Journal-Eintrag.", sl: "Shrani vnos v dnevnik.", en: "Save a journal entry." } },
  { id: "weekly-goal", icon: Target, title: { de: "Wochenrhythmus", sl: "Tedenski ritem", en: "Weekly rhythm" }, body: { de: "Erreiche fünf Lernaktivitäten.", sl: "Dosezi pet učnih dejavnosti.", en: "Reach five learning activities." } },
  { id: "path-complete", icon: Award, title: { de: "Pfad gemeistert", sl: "Obvladana pot", en: "Path completed" }, body: { de: "Erfülle alle Kriterien eines Lernpfads.", sl: "Izpolni vsa merila učne poti.", en: "Meet every criterion in a learning path." } },
];

export function AchievementsPage() {
  const { dictionary, language } = usePreferences();
  const { mode, state } = useDemoWorkspace();
  const query = useQuery({ queryKey: ["academy", "achievements"], queryFn: () => academyApi<RemoteAchievement[]>("/achievements"), enabled: mode === "authenticated", retry: 1 });
  const remote = new Map(query.data?.map((item) => [item.achievement_id, item]));
  const localUnlocked = new Set<string>();
  if (state.completedLessons.length) localUnlocked.add("first-lesson");
  if (state.simulatorSummary && state.simulatorSummary.ruleViolations === 0) localUnlocked.add("risk-plan");
  if (Object.values(state.reviewCards).some((card) => card.reps > 0)) localUnlocked.add("review-session");
  if (state.journalEntries.length) localUnlocked.add("honest-journal");
  if (state.completedLessons.length + Object.keys(state.reviewCards).length + state.journalEntries.length >= 5) localUnlocked.add("weekly-goal");
  return <><PageHeading eyebrow={`${mode === "authenticated" ? remote.size : localUnlocked.size} / ${definitions.length}`} title={dictionary.secondary.achievementsTitle} description={dictionary.secondary.achievementsIntro} /><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{definitions.map((achievement) => { const awarded = mode === "authenticated" ? remote.has(achievement.id) : localUnlocked.has(achievement.id); const Icon = achievement.icon; return <article key={achievement.id} className={`rounded-[var(--radius-lg)] border p-6 ${awarded ? "border-[var(--positive)] bg-[var(--positive-soft)]" : "border-[var(--border-subtle)] bg-[var(--surface-1)]"}`}><div className="flex items-start justify-between"><span className={`grid size-11 place-items-center rounded-full ${awarded ? "bg-[var(--positive)] text-white" : "bg-[var(--surface-2)] text-[var(--text-tertiary)]"}`}><Icon aria-hidden="true" size={20} /></span>{awarded ? <Award aria-label={dictionary.common.complete} size={18} className="text-[var(--positive)]" /> : <LockKeyhole aria-label={dictionary.learn.locked} size={17} className="text-[var(--text-tertiary)]" />}</div><h2 className="mt-5 text-lg font-semibold">{achievement.title[language]}</h2><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{achievement.body[language]}</p>{remote.get(achievement.id)?.awarded_at ? <p className="mt-3 text-xs text-[var(--text-tertiary)]">{new Date(remote.get(achievement.id)?.awarded_at ?? "").toLocaleDateString(language)}</p> : null}</article>; })}</section></>;
}
