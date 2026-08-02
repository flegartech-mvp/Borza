"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, BookHeart, CalendarDays, ShieldCheck } from "lucide-react";
import { PageHeading } from "@/components/academy/page-heading";
import { Button } from "@/components/ui/button";
import { useDemoWorkspace } from "@/features/demo/demo-workspace-provider";
import { usePreferences } from "@/features/preferences";
import type { JournalEntry } from "@/lib/academy-types";
import { academyApi } from "@/lib/api-client";

type FormValues = {
  setup: string; thesis: string; context: string; entry: number; stop: number; target: number;
  plannedRisk: number; actualRisk: number; resultAmount: number; resultR: number;
  emotionBefore: string; emotionDuring: string; emotionAfter: string; followedRules: boolean;
  lesson: string; tags: string; chartSnapshotUrl: string;
};
type RemoteSummary = { entry_count: number; top_setups: Array<{ name: string; count: number }>; common_emotions: Array<{ name: string; count: number }>; repeated_mistakes: Array<{ name: string; count: number }>; average_rule_adherence: number | string | null; strongest_setups: Array<{ setup: string; average_r: number | string | null }>; weakest_setups: Array<{ setup: string; average_r: number | string | null }>; last_7_days: { entry_count: number; average_r: number | string | null }; last_30_days: { entry_count: number; average_r: number | string | null } };

const copy = {
  de: { actualRisk: "Tatsächliches Risiko", resultAmount: "Ergebnisbetrag", emotionDuring: "Emotion während des Trades", snapshot: "Chart-Snapshot-URL", rules: "Regeln befolgt", weekly: "Wochenrückblick", monthly: "Monatsrückblick", strongest: "Stärkste Setups", weakest: "Schwächste Setups", empty: "Noch keine Einträge. Dokumentiere zuerst einen simulierten Entscheid.", required: "Bitte fülle alle Pflichtfelder mit gültigen Werten aus.", count: "Einträge", avgR: "Ø R", adherence: "Regeltreue" },
  sl: { actualRisk: "Dejansko tveganje", resultAmount: "Znesek rezultata", emotionDuring: "Čustvo med poslom", snapshot: "URL posnetka grafa", rules: "Pravila upoštevana", weekly: "Tedenski pregled", monthly: "Mesečni pregled", strongest: "Najmočnejši setupi", weakest: "Najšibkejši setupi", empty: "Vnosov še ni. Najprej zapiši simulirano odločitev.", required: "Izpolni vsa obvezna polja z veljavnimi vrednostmi.", count: "Vnosi", avgR: "Povp. R", adherence: "Upoštevanje pravil" },
  en: { actualRisk: "Actual risk", resultAmount: "Result amount", emotionDuring: "Emotion during trade", snapshot: "Chart snapshot URL", rules: "Rules followed", weekly: "Weekly review", monthly: "Monthly review", strongest: "Strongest setups", weakest: "Weakest setups", empty: "No entries yet. Record a simulated decision first.", required: "Complete every required field with a valid value.", count: "Entries", avgR: "Average R", adherence: "Rule adherence" },
};

export function TradingJournal() {
  const { dictionary, language } = usePreferences();
  const { state, mode, addJournalEntry } = useDemoWorkspace();
  const strings = copy[language];
  const [now] = useState(() => Date.now());
  const [status, setStatus] = useState<string | null>(null);
  const form = useForm<FormValues>({ defaultValues: { followedRules: true } });
  const summaryQuery = useQuery({ queryKey: ["academy", "journal-summary"], queryFn: () => academyApi<RemoteSummary>("/journal/summary"), enabled: mode === "authenticated", retry: 1 });
  const localSummary = useMemo(() => {
    const entries = state.journalEntries;
    const count = (values: string[]) => Object.entries(values.filter(Boolean).reduce<Record<string, number>>((result, value) => ({ ...result, [value]: (result[value] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
    const setupGroups = entries.reduce<Record<string, number[]>>((result, entry) => ({ ...result, [entry.setup]: [...(result[entry.setup] ?? []), entry.resultR] }), {});
    const setups = Object.entries(setupGroups).map(([name, results]) => ({ name, average: results.reduce((sum, value) => sum + value, 0) / results.length })).sort((a, b) => b.average - a.average);
    const within = (days: number) => entries.filter((entry) => now - Date.parse(entry.createdAt) <= days * 86_400_000);
    return { tags: count(entries.flatMap((entry) => entry.tags)), emotions: count(entries.flatMap((entry) => [entry.emotionBefore, entry.emotionDuring ?? "", entry.emotionAfter])), setups, weekly: within(7), monthly: within(30), adherence: entries.length ? (entries.filter((entry) => entry.followedRules).length / entries.length) * 100 : 0 };
  }, [now, state.journalEntries]);

  const submit = form.handleSubmit(async (values) => {
    setStatus(null);
    const entry: JournalEntry = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), setup: values.setup.trim(), thesis: values.thesis.trim(), context: values.context.trim(), entry: values.entry, stop: values.stop, target: values.target, plannedRisk: values.plannedRisk, actualRisk: values.actualRisk, resultAmount: values.resultAmount, resultR: values.resultR, emotionBefore: values.emotionBefore.trim(), emotionDuring: values.emotionDuring.trim(), emotionAfter: values.emotionAfter.trim(), followedRules: values.followedRules, lesson: values.lesson.trim(), tags: values.tags.split(",").map((tag) => tag.trim()).filter(Boolean), chartSnapshotUrl: values.chartSnapshotUrl.trim() };
    try { await addJournalEntry(entry); form.reset({ followedRules: true }); setStatus(dictionary.journal.saved); }
    catch (reason) { setStatus(reason instanceof Error ? reason.message : dictionary.auth.error); }
  });

  const textFields: Array<{ name: keyof FormValues; label: string; area?: boolean; required?: boolean }> = [
    { name: "setup", label: dictionary.journal.setup, required: true }, { name: "thesis", label: dictionary.journal.thesis, area: true, required: true }, { name: "context", label: dictionary.journal.context, area: true, required: true },
    { name: "emotionBefore", label: language === "en" ? "Emotion before" : dictionary.journal.emotionBefore }, { name: "emotionDuring", label: strings.emotionDuring }, { name: "emotionAfter", label: language === "en" ? "Emotion after" : dictionary.journal.emotionAfter },
    { name: "lesson", label: language === "en" ? "Lesson learned" : dictionary.journal.lesson, area: true, required: true }, { name: "tags", label: dictionary.journal.tags }, { name: "chartSnapshotUrl", label: strings.snapshot },
  ];
  const numberFields: Array<{ name: keyof FormValues; label: string; required?: boolean }> = [
    { name: "entry", label: dictionary.journal.entry, required: true }, { name: "stop", label: dictionary.journal.stop, required: true }, { name: "target", label: dictionary.journal.target, required: true }, { name: "plannedRisk", label: dictionary.journal.plannedRisk, required: true }, { name: "actualRisk", label: strings.actualRisk, required: true }, { name: "resultAmount", label: strings.resultAmount }, { name: "resultR", label: language === "en" ? "Result in R" : dictionary.journal.result, required: true },
  ];
  return (
    <>
      <PageHeading eyebrow={dictionary.brand.name} title={dictionary.journal.title} description={dictionary.journal.intro} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <form onSubmit={(event) => void submit(event)} className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 sm:p-7">
          <div className="grid gap-4 sm:grid-cols-2">{textFields.map((field) => <label key={field.name} className={field.area ? "sm:col-span-2" : ""}><span className="text-sm font-semibold">{field.label}</span>{field.area ? <textarea rows={4} {...form.register(field.name, { required: field.required })} className="mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3" /> : <input type={field.name === "chartSnapshotUrl" ? "url" : "text"} {...form.register(field.name, { required: field.required })} className="mt-2 min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3" />}</label>)}</div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{numberFields.map((field) => <label key={field.name}><span className="text-sm font-semibold">{field.label}</span><input type="number" step="any" {...form.register(field.name, { required: field.required, valueAsNumber: true })} className="numeric mt-2 min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3" /></label>)}</div>
          <label className="mt-5 flex min-h-11 items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3"><input type="checkbox" {...form.register("followedRules")} className="size-5" /><span className="font-semibold">{strings.rules}</span></label>
          {Object.keys(form.formState.errors).length ? <p role="alert" className="mt-4 text-sm text-[var(--negative)]">{strings.required}</p> : null}{status ? <p role="status" className="mt-4 text-sm text-[var(--brand)]">{status}</p> : null}<Button type="submit" loading={form.formState.isSubmitting} className="mt-5 w-full">{language === "en" ? "Save entry" : dictionary.journal.add}</Button>
        </form>
        <aside className="space-y-4">
          <SummaryCard icon={CalendarDays} title={strings.weekly} value={String(summaryQuery.data?.last_7_days.entry_count ?? localSummary.weekly.length)} detail={`${strings.avgR}: ${Number(summaryQuery.data?.last_7_days.average_r ?? averageR(localSummary.weekly)).toFixed(2)}`} />
          <SummaryCard icon={BarChart3} title={strings.monthly} value={String(summaryQuery.data?.last_30_days.entry_count ?? localSummary.monthly.length)} detail={`${strings.adherence}: ${Number(summaryQuery.data?.average_rule_adherence ?? localSummary.adherence).toFixed(0)}%`} />
          <SummaryCard icon={ShieldCheck} title={dictionary.journal.repeated} value={String(summaryQuery.data?.repeated_mistakes.length ?? localSummary.tags.length)} detail={(summaryQuery.data?.repeated_mistakes.map((item) => item.name) ?? localSummary.tags.map(([name]) => name)).slice(0, 3).join(" · ") || "—"} />
          <SummaryCard icon={BookHeart} title={dictionary.journal.patterns} value={String(summaryQuery.data?.common_emotions.length ?? localSummary.emotions.length)} detail={(summaryQuery.data?.common_emotions.map((item) => item.name) ?? localSummary.emotions.map(([name]) => name)).slice(0, 3).join(" · ") || "—"} />
        </aside>
      </div>
      <section className="mt-7"><h2 className="text-xl font-semibold">{dictionary.journal.saved}</h2>{state.journalEntries.length ? <div className="mt-4 grid gap-3 lg:grid-cols-2">{state.journalEntries.map((entry) => <article key={entry.id} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{entry.setup}</h3><span className={`numeric rounded-full px-2 py-1 text-xs ${entry.followedRules ? "bg-[var(--positive-soft)] text-[var(--positive)]" : "bg-[var(--warning-soft)] text-[var(--warning)]"}`}>{entry.resultR.toFixed(2)}R</span></div><p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--text-secondary)]">{entry.thesis}</p><p className="mt-3 text-xs text-[var(--text-tertiary)]">{new Date(entry.createdAt).toLocaleDateString(language)} · {entry.tags.join(" · ")}</p></article>)}</div> : <p className="mt-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-5 text-sm text-[var(--text-secondary)]">{strings.empty}</p>}</section>
    </>
  );
}

function averageR(entries: JournalEntry[]) { return entries.length ? entries.reduce((sum, entry) => sum + entry.resultR, 0) / entries.length : 0; }
function SummaryCard({ icon: Icon, title, value, detail }: { icon: typeof BarChart3; title: string; value: string; detail: string }) { return <article className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5"><Icon aria-hidden="true" size={18} className="text-[var(--brand)]" /><p className="mt-4 text-xs text-[var(--text-tertiary)]">{title}</p><p className="numeric mt-1 text-2xl font-semibold">{value}</p><p className="mt-2 text-sm text-[var(--text-secondary)]">{detail}</p></article>; }
