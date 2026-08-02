"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Calculator, CircleAlert, ListChecks } from "lucide-react";
import { PageHeading } from "@/components/academy/page-heading";
import { Button, Surface } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-provider";
import { usePreferences } from "@/features/preferences";
import { academyApi } from "@/lib/api-client";
import { practicalContent, practicalDisclaimer } from "./content";
import { evaluateDecision, evidenceFromAttempt } from "./engine";
import { saveDemoAttempt } from "./practical-store";
import type { PracticalAttempt } from "./types";

const copy = {
  de: {
    eyebrow: "Erklären statt raten",
    title: "Decision Lab",
    intro:
      "Bearbeite reale Zielkonflikte mit Daten, fehlenden Informationen, Berechnungen und Reflexion. Die Qualität des Prozesses zählt—nicht Glück.",
    cases: "Fälle",
    known: "Bekannte Daten",
    missing: "Vor einer Entscheidung klären",
    calculate: "Eigene Berechnungen",
    options: "Handlungsoptionen",
    reasoning: "Begründung",
    reasoningHint:
      "Welche Annahmen, Risiken und Opportunitätskosten bestimmen deine Wahl?",
    submit: "Prozess auswerten",
    result: "Prozessevidenz",
    reflection: "Reflexionsfrage",
    next: "Nächster Fall",
    passport: "Im Kompetenzpass ansehen",
    error: "Der Versuch konnte nicht gespeichert werden.",
  },
  sl: {
    eyebrow: "Razloži, ne ugibaj",
    title: "Laboratorij odločitev",
    intro:
      "Rešuj resnične konflikte ciljev s podatki, manjkajočimi informacijami, izračuni in refleksijo. Šteje kakovost procesa—ne sreča.",
    cases: "Primeri",
    known: "Znani podatki",
    missing: "Preveri pred odločitvijo",
    calculate: "Lastni izračuni",
    options: "Možnosti ukrepanja",
    reasoning: "Utemeljitev",
    reasoningHint:
      "Katere predpostavke, tveganja in oportunitetni stroški določajo tvojo izbiro?",
    submit: "Oceni proces",
    result: "Dokaz procesa",
    reflection: "Vprašanje za refleksijo",
    next: "Naslednji primer",
    passport: "Poglej v kompetenčnem potnem listu",
    error: "Poskusa ni bilo mogoče shraniti.",
  },
  en: {
    eyebrow: "Explain, do not guess",
    title: "Decision Lab",
    intro:
      "Work through real trade-offs with data, missing information, calculations, and reflection. Process quality counts—not luck.",
    cases: "Cases",
    known: "Known data",
    missing: "Clarify before deciding",
    calculate: "Your calculations",
    options: "Action options",
    reasoning: "Reasoning",
    reasoningHint:
      "Which assumptions, risks, and opportunity costs determine your choice?",
    submit: "Evaluate process",
    result: "Process evidence",
    reflection: "Reflection question",
    next: "Next case",
    passport: "View in competence passport",
    error: "The attempt could not be saved.",
  },
} as const;

type RemoteAttempt = {
  id: string;
  process_score: number;
  feedback: Record<string, unknown>;
  completed_at: string;
};

export function DecisionLab() {
  const { language } = usePreferences();
  const { user } = useAuth();
  const t = copy[language];
  const [caseIndex, setCaseIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [calculations, setCalculations] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PracticalAttempt | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const item = practicalContent.decisions[caseIndex];

  function reset(index: number) {
    setCaseIndex(index);
    setSelected("");
    setReasoning("");
    setCalculations({});
    setResult(null);
    setError("");
  }

  async function submit() {
    if (!selected || reasoning.trim().length < 20) return;
    setSaving(true);
    setError("");
    const numeric = Object.fromEntries(
      Object.entries(calculations)
        .map(([key, value]) => [key, Number(value)] as const)
        .filter(([, value]) => Number.isFinite(value)),
    );
    const evaluated = evaluateDecision(item, selected, reasoning, numeric);
    try {
      if (user) {
        const remote = await academyApi<RemoteAttempt>("/practical/attempts", {
          method: "POST",
          body: {
            activity_type: "decision_lab",
            activity_id: item.id,
            content_version: item.version,
            selected_option_id: selected,
            reasoning,
            assumptions: item.missing_information,
            calculations: numeric,
          },
        });
        evaluated.id = remote.id;
        evaluated.processScore = remote.process_score;
        evaluated.feedback = remote.feedback;
        evaluated.completedAt = remote.completed_at;
      } else {
        saveDemoAttempt(evaluated, evidenceFromAttempt(evaluated));
      }
      setResult(evaluated);
    } catch {
      setError(t.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeading eyebrow={t.eyebrow} title={t.title} description={t.intro} />
      <div className="mb-5 flex items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--warning)] bg-[var(--warning-soft)] p-3 text-sm leading-6">
        <CircleAlert className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
        {practicalDisclaimer[language]}
      </div>
      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <nav
          aria-label={t.cases}
          className="h-fit rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3 xl:sticky xl:top-24"
        >
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[.15em] text-[var(--text-tertiary)]">
            {t.cases} · {practicalContent.decisions.length}
          </p>
          <ol className="grid gap-1 sm:grid-cols-2 xl:grid-cols-1">
            {practicalContent.decisions.map((entry, index) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => reset(index)}
                  aria-current={index === caseIndex ? "page" : undefined}
                  className={`w-full rounded-[var(--radius-sm)] px-3 py-3 text-left text-sm ${index === caseIndex ? "bg-[var(--brand-soft)] font-semibold text-[var(--brand)]" : "hover:bg-[var(--surface-2)]"}`}
                >
                  <span className="numeric mr-2 text-xs">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {entry.title[language]}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <article>
          <Surface padding="lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[.15em] text-[var(--electric)]">
                {item.difficulty} · v{item.version}
              </p>
              <span className="rounded-full bg-[var(--surface-3)] px-3 py-1 text-xs">
                {caseIndex + 1} / {practicalContent.decisions.length}
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">
              {item.title[language]}
            </h2>
            <p className="mt-4 max-w-4xl leading-7 text-[var(--text-secondary)]">
              {item.context[language]}
            </p>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <section className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-4">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Calculator size={17} aria-hidden="true" />
                  {t.known}
                </h3>
                <dl className="mt-3 grid grid-cols-2 gap-2">
                  {Object.entries(item.financial_data).map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded bg-[var(--surface-1)] p-3"
                    >
                      <dt className="text-xs text-[var(--text-tertiary)]">
                        {key.replaceAll("_", " ")}
                      </dt>
                      <dd className="numeric mt-1 font-semibold">
                        {value.toLocaleString(language)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
              <section className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-4">
                <h3 className="flex items-center gap-2 font-semibold">
                  <ListChecks size={17} aria-hidden="true" />
                  {t.missing}
                </h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[var(--text-secondary)]">
                  {item.missing_information.map((value) => (
                    <li key={value}>{value.replaceAll("_", " ")}</li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="mt-6">
              <h3 className="font-semibold">{t.calculate}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {item.required_calculations.map((calculation) => (
                  <label key={calculation} className="text-sm font-semibold">
                    {calculation.replaceAll("-", " ")}
                    <input
                      type="number"
                      inputMode="decimal"
                      value={calculations[calculation] ?? ""}
                      onChange={(event) =>
                        setCalculations((current) => ({
                          ...current,
                          [calculation]: event.target.value,
                        }))
                      }
                      disabled={Boolean(result)}
                      className="numeric mt-2 min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 font-normal"
                    />
                  </label>
                ))}
              </div>
            </section>

            <fieldset className="mt-6" disabled={Boolean(result)}>
              <legend className="font-semibold">{t.options}</legend>
              <div className="mt-3 grid gap-3">
                {item.options.map((option) => (
                  <label
                    key={option.id}
                    className={`cursor-pointer rounded-[var(--radius-sm)] border p-4 ${selected === option.id ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--border-subtle)] bg-[var(--surface-2)]"}`}
                  >
                    <input
                      type="radio"
                      name="decision-option"
                      checked={selected === option.id}
                      onChange={() => setSelected(option.id)}
                      className="mr-3 accent-[var(--brand)]"
                    />
                    <span className="font-semibold">
                      {option.label[language]}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="mt-5 block text-sm font-semibold">
              {t.reasoning}
              <textarea
                rows={5}
                value={reasoning}
                disabled={Boolean(result)}
                onChange={(event) => setReasoning(event.target.value)}
                placeholder={t.reasoningHint}
                className="mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 font-normal"
              />
            </label>
            {!result ? (
              <Button
                className="mt-5"
                loading={saving}
                disabled={!selected || reasoning.trim().length < 20}
                onClick={() => void submit()}
              >
                {t.submit}
              </Button>
            ) : null}
            {error ? (
              <p className="mt-3 text-sm text-[var(--negative)]" role="alert">
                {error}
              </p>
            ) : null}
          </Surface>

          {result ? (
            <Surface
              className="mt-4 border-[var(--positive)] bg-[var(--positive-soft)]"
              padding="lg"
              aria-live="polite"
            >
              <p className="text-sm font-semibold text-[var(--positive)]">
                {t.result}
              </p>
              <p className="numeric mt-2 text-4xl font-semibold">
                {result.processScore}%
              </p>
              <p className="mt-3 leading-7">
                {(
                  result.feedback.message as Record<string, string> | undefined
                )?.[language] ??
                  item.options.find((option) => option.id === selected)
                    ?.feedback[language]}
              </p>
              <h3 className="mt-5 font-semibold">{t.reflection}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                {item.reflection[language]}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  onClick={() =>
                    reset((caseIndex + 1) % practicalContent.decisions.length)
                  }
                >
                  {t.next}
                  <ArrowRight size={16} aria-hidden="true" />
                </Button>
                <Link
                  href="/passport"
                  className="inline-flex min-h-10 items-center rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-4 text-sm font-semibold"
                >
                  {t.passport}
                </Link>
              </div>
            </Surface>
          ) : null}
        </article>
      </div>
    </>
  );
}
