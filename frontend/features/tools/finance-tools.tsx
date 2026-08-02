"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import katex from "katex";
import {
  ArrowRight,
  BookOpen,
  Calculator,
  ChartNoAxesCombined,
  CircleDollarSign,
  Info,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { PageHeading } from "@/components/academy/page-heading";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/features/preferences";
import type { Language } from "@/i18n/dictionaries";
import {
  CALCULATORS,
  calculateTool,
  defaultInputs,
  getCalculator,
  type CalculationOutcome,
  type CalculatorCategory,
  type CalculatorDefinition,
  type CalculatorId,
  type InputDefinition,
  type OutputDefinition,
  type ValidationIssue,
} from "./calculators";

type CategoryFilter = "all" | CalculatorCategory;

const COPY = {
  de: {
    eyebrow: "18 interaktive Rechner",
    all: "Alle",
    trading: "Trading & Risiko",
    finance: "Finanzen & Bewertung",
    select: "Rechner auswählen",
    selectHint: "Jeder Rechner enthält Validierung, Formel und Lernkontext.",
    calculator: "Rechner",
    inputs: "Eingaben",
    useExample: "Beispiel einsetzen",
    reset: "Zurücksetzen",
    ready: "Gültige Eingaben berechnen, um das Ergebnis zu sehen.",
    learningContext: "Lernkontext",
    formulaAccessible: "Mathematische Formel",
    educationOnly:
      "Lernwerkzeug – keine Anlageberatung. Ergebnisse sind Modellrechnungen und berücksichtigen nicht automatisch Steuern, Gebühren, Slippage oder individuelle Risiken.",
    units: "Stück",
    errors: {
      required: "Wert fehlt.",
      invalidNumber: "Gib eine endliche Zahl ein.",
      invalidSeries: "Trenne mindestens zwei gültige Zahlen mit Semikolon.",
      minimum: "Der Wert muss mindestens {limit} sein.",
      exclusiveMinimum: "Der Wert muss größer als {limit} sein.",
      maximum: "Der Wert darf höchstens {limit} sein.",
      integer: "Gib eine ganze Zahl ein.",
      entryStopDifferent: "Einstieg und Stop müssen verschieden sein.",
      oppositeSides:
        "Stop und Ziel müssen auf gegenüberliegenden Seiten des Einstiegs liegen.",
      troughAbovePeak: "Der Tiefstand darf nicht über dem Höchststand liegen.",
      cashFlowSigns:
        "Die Reihe braucht mindestens einen negativen und einen positiven Cashflow.",
      multipleIrr:
        "Mehrere Vorzeichenwechsel können mehrere IRRs erzeugen; nutze NPV-Szenarien.",
      irrBracket:
        "Im begrenzten Bereich von −99,99 % bis 1.000 % wurde keine Lösung gefunden.",
      irrConvergence: "Die begrenzte IRR-Suche ist nicht konvergiert.",
      discountAboveGrowth:
        "Der Diskontsatz muss über dem ewigen Wachstum liegen.",
      nonFiniteResult: "Diese Eingaben erzeugen kein endliches Ergebnis.",
    },
  },
  sl: {
    eyebrow: "18 interaktivnih kalkulatorjev",
    all: "Vsi",
    trading: "Trgovanje in tveganje",
    finance: "Finance in vrednotenje",
    select: "Izberi kalkulator",
    selectHint:
      "Vsak kalkulator vsebuje preverjanje, formulo in učni kontekst.",
    calculator: "Kalkulator",
    inputs: "Vnosi",
    useExample: "Vstavi primer",
    reset: "Ponastavi",
    ready: "Izračunaj veljavne vnose za prikaz rezultata.",
    learningContext: "Učni kontekst",
    formulaAccessible: "Matematična formula",
    educationOnly:
      "Učno orodje – ne investicijski nasvet. Modelni rezultati samodejno ne vključujejo davkov, stroškov, zdrsa ali osebnega tveganja.",
    units: "enot",
    errors: {
      required: "Vrednost manjka.",
      invalidNumber: "Vnesi končno število.",
      invalidSeries: "S podpičjem loči vsaj dve veljavni števili.",
      minimum: "Vrednost mora biti najmanj {limit}.",
      exclusiveMinimum: "Vrednost mora biti večja od {limit}.",
      maximum: "Vrednost je lahko največ {limit}.",
      integer: "Vnesi celo število.",
      entryStopDifferent: "Vstop in stop morata biti različna.",
      oppositeSides: "Stop in cilj morata biti na nasprotnih straneh vstopa.",
      troughAbovePeak: "Dno ne sme biti nad vrhom.",
      cashFlowSigns:
        "Niz potrebuje vsaj en negativen in en pozitiven denarni tok.",
      multipleIrr:
        "Več sprememb predznaka lahko ustvari več IRR; uporabi scenarije NPV.",
      irrBracket: "V omejenem območju od −99,99 % do 1.000 % ni rešitve.",
      irrConvergence: "Omejeno iskanje IRR ni konvergiralo.",
      discountAboveGrowth: "Diskontna mera mora biti višja od večne rasti.",
      nonFiniteResult: "Ti vnosi ne ustvarijo končnega rezultata.",
    },
  },
  en: {
    eyebrow: "18 interactive calculators",
    all: "All",
    trading: "Trading & risk",
    finance: "Finance & valuation",
    select: "Choose a calculator",
    selectHint:
      "Every calculator includes validation, its formula, and learning context.",
    calculator: "Calculator",
    inputs: "Inputs",
    useExample: "Use worked example",
    reset: "Reset",
    ready: "Calculate valid inputs to see the result.",
    learningContext: "Learning context",
    formulaAccessible: "Mathematical formula",
    educationOnly:
      "Learning tool—not investment advice. Model outputs do not automatically include tax, fees, slippage, or personal risk.",
    units: "units",
    errors: {
      required: "A value is required.",
      invalidNumber: "Enter a finite number.",
      invalidSeries: "Separate at least two valid numbers with semicolons.",
      minimum: "The value must be at least {limit}.",
      exclusiveMinimum: "The value must be greater than {limit}.",
      maximum: "The value must be no more than {limit}.",
      integer: "Enter a whole number.",
      entryStopDifferent: "Entry and stop must be different.",
      oppositeSides: "Stop and target must be on opposite sides of entry.",
      troughAbovePeak: "Trough cannot be above peak.",
      cashFlowSigns:
        "The series needs at least one negative and one positive cash flow.",
      multipleIrr:
        "Multiple sign changes can create multiple IRRs; use NPV scenarios instead.",
      irrBracket:
        "No solution was found in the bounded range from −99.99% to 1,000%.",
      irrConvergence: "The bounded IRR search did not converge.",
      discountAboveGrowth: "Discount rate must be above perpetual growth.",
      nonFiniteResult: "These inputs do not produce a finite result.",
    },
  },
} as const;

const NUMBER_LOCALES: Record<Language, string> = {
  de: "de-DE",
  sl: "sl-SI",
  en: "en-GB",
};

function Formula({
  formula,
  language,
}: {
  formula: string;
  language: Language;
}) {
  const markup = useMemo(
    () =>
      katex.renderToString(formula, {
        output: "htmlAndMathml",
        strict: false,
        throwOnError: false,
      }),
    [formula],
  );
  return (
    <div
      className="overflow-x-auto py-2 text-center text-lg text-[var(--text-primary)] sm:text-xl"
      role="region"
      aria-label={COPY[language].formulaAccessible}
      // Formula strings are static, version-controlled metadata—not user input.
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

function replaceLimit(
  template: string,
  issue: ValidationIssue,
  language: Language,
): string {
  if (issue.limit === undefined) return template;
  const formatted = new Intl.NumberFormat(NUMBER_LOCALES[language], {
    maximumFractionDigits: 6,
  }).format(issue.limit);
  return template.replace("{limit}", formatted);
}

function validationMessage(
  issue: ValidationIssue,
  definition: CalculatorDefinition,
  language: Language,
): string {
  const input = definition.inputs.find(
    (candidate) => candidate.key === issue.field,
  );
  const prefix = input ? `${input.label[language]}: ` : "";
  return `${prefix}${replaceLimit(COPY[language].errors[issue.code], issue, language)}`;
}

function formatResult(
  value: number,
  output: OutputDefinition,
  language: Language,
): string {
  if (output.kind === "currency") {
    return new Intl.NumberFormat(NUMBER_LOCALES[language], {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: output.decimals,
      maximumFractionDigits: output.decimals,
    }).format(value);
  }
  const formatted = new Intl.NumberFormat(NUMBER_LOCALES[language], {
    minimumFractionDigits: output.decimals,
    maximumFractionDigits: output.decimals,
    signDisplay:
      output.key === "rMultiple" || output.key === "expectancy"
        ? "exceptZero"
        : "auto",
  }).format(value);
  if (output.kind === "percent") return `${formatted} %`;
  if (output.kind === "units") return `${formatted} ${COPY[language].units}`;
  if (output.key === "ratio") return `${formatted} : 1`;
  if (output.key === "leverage") return `${formatted}×`;
  if (output.key === "rMultiple" || output.key === "expectancy")
    return `${formatted} R`;
  return formatted;
}

function ToolSelector({
  definition,
  active,
  index,
  language,
  onSelect,
}: {
  definition: CalculatorDefinition;
  active: boolean;
  index: number;
  language: Language;
  onSelect: (id: CalculatorId) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-controls="calculator-workspace"
      onClick={() => onSelect(definition.id)}
      className={`group min-h-0 w-full rounded-[var(--radius-md)] border p-4 text-left transition-colors ${
        active
          ? "border-[var(--brand)] bg-[var(--brand-soft)]"
          : "border-[var(--border-subtle)] bg-[var(--surface-1)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
      }`}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="numeric text-[11px] text-[var(--text-tertiary)]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[.08em] ${
            definition.category === "trading"
              ? "bg-[var(--warning-soft)] text-[var(--warning)]"
              : "bg-[var(--electric-soft)] text-[var(--electric)]"
          }`}
        >
          {COPY[language][definition.category]}
        </span>
      </span>
      <span className="mt-3 block font-semibold">
        {definition.title[language]}
      </span>
      <span className="mt-1.5 line-clamp-2 block text-xs leading-5 text-[var(--text-secondary)]">
        {definition.summary[language]}
      </span>
    </button>
  );
}

function InputControl({
  input,
  value,
  language,
  issue,
  onChange,
}: {
  input: InputDefinition;
  value: string;
  language: Language;
  issue?: ValidationIssue;
  onChange: (key: string, value: string) => void;
}) {
  const inputId = `tool-input-${input.key}`;
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  const describedBy = [input.help ? helpId : null, issue ? errorId : null]
    .filter(Boolean)
    .join(" ");
  const sharedClassName = `w-full rounded-[var(--radius-sm)] border bg-[var(--surface-2)] px-3 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] ${
    issue ? "border-[var(--negative)]" : "border-[var(--border-subtle)]"
  }`;
  return (
    <div>
      <label htmlFor={inputId} className="text-sm font-semibold">
        {input.label[language]}
      </label>
      <div className="relative mt-2">
        {input.kind === "series" ? (
          <textarea
            id={inputId}
            rows={3}
            value={value}
            aria-describedby={describedBy || undefined}
            aria-invalid={issue ? true : undefined}
            className={`${sharedClassName} min-h-24 resize-y font-mono text-sm`}
            onChange={(event) => onChange(input.key, event.target.value)}
          />
        ) : (
          <input
            id={inputId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            aria-describedby={describedBy || undefined}
            aria-invalid={issue ? true : undefined}
            className={`${sharedClassName} numeric ${input.suffix ? "pr-20" : ""}`}
            onChange={(event) => onChange(input.key, event.target.value)}
          />
        )}
        {input.kind === "number" && input.suffix ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-[var(--text-tertiary)]"
          >
            {input.suffix[language]}
          </span>
        ) : null}
      </div>
      {input.help ? (
        <p
          id={helpId}
          className="mt-1.5 text-xs leading-5 text-[var(--text-tertiary)]"
        >
          {input.help[language]}
        </p>
      ) : null}
      {issue ? (
        <p
          id={errorId}
          className="mt-1.5 text-xs font-semibold text-[var(--negative)]"
        >
          {validationMessage(issue, getCalculatorFromInput(input), language)}
        </p>
      ) : null}
    </div>
  );
}

function getCalculatorFromInput(input: InputDefinition): CalculatorDefinition {
  const definition = CALCULATORS.find((calculator) =>
    calculator.inputs.includes(input),
  );
  if (!definition) throw new Error(`Orphan calculator input: ${input.key}`);
  return definition;
}

function Results({
  definition,
  outcome,
  language,
}: {
  definition: CalculatorDefinition;
  outcome: CalculationOutcome | null;
  language: Language;
}) {
  if (!outcome) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] p-5 text-sm text-[var(--text-secondary)]">
        {COPY[language].ready}
      </div>
    );
  }
  if (!outcome.ok) {
    return (
      <div
        role="alert"
        className="rounded-[var(--radius-md)] border border-[var(--negative)] bg-[var(--negative-soft)] p-5"
      >
        <p className="flex items-center gap-2 font-semibold text-[var(--negative)]">
          <TriangleAlert aria-hidden="true" size={18} />
          {COPY[language].errors.invalidNumber}
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6">
          {outcome.issues.map((issue, index) => (
            <li key={`${issue.code}-${issue.field ?? "result"}-${index}`}>
              {validationMessage(issue, definition, language)}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div
      className="grid gap-3 sm:grid-cols-2"
      aria-live="polite"
      aria-atomic="true"
    >
      {definition.outputs.map((result) => (
        <div
          key={result.key}
          className="rounded-[var(--radius-md)] border border-[var(--brand)] bg-[var(--brand-soft)] p-5"
        >
          <p className="text-xs font-semibold uppercase tracking-[.1em] text-[var(--brand)]">
            {result.label[language]}
          </p>
          <p className="numeric mt-2 break-words text-2xl font-semibold sm:text-3xl">
            {formatResult(outcome.values[result.key], result, language)}
          </p>
        </div>
      ))}
    </div>
  );
}

function LearningCard({
  title,
  body,
  tone = "neutral",
}: {
  title: string;
  body: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <article
      className={`rounded-[var(--radius-md)] border p-4 sm:p-5 ${
        tone === "warning"
          ? "border-[var(--warning)] bg-[var(--warning-soft)]"
          : "border-[var(--border-subtle)] bg-[var(--surface-2)]"
      }`}
    >
      <h4 className="text-sm font-semibold">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        {body}
      </p>
    </article>
  );
}

export function FinanceTools() {
  const { dictionary, language } = usePreferences();
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [activeId, setActiveId] = useState<CalculatorId>(CALCULATORS[0].id);
  const [inputs, setInputs] = useState<Record<string, string>>(() =>
    defaultInputs(CALCULATORS[0]),
  );
  const [outcome, setOutcome] = useState<CalculationOutcome | null>(null);
  const active = getCalculator(activeId);
  const visibleCalculators =
    category === "all"
      ? CALCULATORS
      : CALCULATORS.filter((calculator) => calculator.category === category);
  const issues = outcome && !outcome.ok ? outcome.issues : [];

  function selectCalculator(id: CalculatorId) {
    const definition = getCalculator(id);
    setActiveId(id);
    setInputs(defaultInputs(definition));
    setOutcome(null);
  }

  function selectCategory(nextCategory: CategoryFilter) {
    setCategory(nextCategory);
    if (nextCategory !== "all" && active.category !== nextCategory) {
      const next = CALCULATORS.find(
        (calculator) => calculator.category === nextCategory,
      );
      if (next) selectCalculator(next.id);
    }
  }

  function updateInput(key: string, value: string) {
    setInputs((current) => ({ ...current, [key]: value }));
    setOutcome(null);
  }

  function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOutcome(calculateTool(active.id, inputs));
  }

  function loadExample() {
    const defaults = defaultInputs(active);
    setInputs(defaults);
    setOutcome(calculateTool(active.id, defaults));
  }

  function reset() {
    setInputs(defaultInputs(active));
    setOutcome(null);
  }

  return (
    <>
      <PageHeading
        eyebrow={COPY[language].eyebrow}
        title={dictionary.tools.title}
        description={dictionary.tools.intro}
        actions={
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--brand)] bg-[var(--brand-soft)] px-3 py-2 text-xs font-semibold text-[var(--brand)]">
            <ShieldCheck aria-hidden="true" size={15} />
            {COPY[language].educationOnly.split(".")[0]}
          </span>
        }
      />

      <section
        aria-label={COPY[language].select}
        className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--background-raised)] p-4 sm:p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Calculator
                aria-hidden="true"
                className="text-[var(--brand)]"
                size={22}
              />
              {COPY[language].select}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {COPY[language].selectHint}
            </p>
          </div>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label={COPY[language].select}
          >
            {(["all", "trading", "finance"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                aria-pressed={category === filter}
                onClick={() => selectCategory(filter)}
                className={`min-h-10 rounded-full border px-3 text-sm font-semibold transition-colors ${
                  category === filter
                    ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--text-secondary)]"
                }`}
              >
                {COPY[language][filter]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[21rem_minmax(0,1fr)]">
          <nav
            aria-label={COPY[language].select}
            className="grid content-start gap-2 sm:grid-cols-2 xl:max-h-[76rem] xl:grid-cols-1 xl:overflow-y-auto xl:pr-2"
          >
            {visibleCalculators.map((definition) => (
              <ToolSelector
                key={definition.id}
                definition={definition}
                active={definition.id === activeId}
                index={CALCULATORS.indexOf(definition)}
                language={language}
                onSelect={selectCalculator}
              />
            ))}
          </nav>

          <article
            id="calculator-workspace"
            className="min-w-0 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-1)] p-4 shadow-[var(--shadow-card)] sm:p-6 lg:p-8"
          >
            <header className="border-b border-[var(--border-subtle)] pb-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="rounded-full bg-[var(--surface-3)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                  {COPY[language][active.category]}
                </span>
                <span className="numeric text-xs text-[var(--text-tertiary)]">
                  {COPY[language].calculator}{" "}
                  {String(CALCULATORS.indexOf(active) + 1).padStart(2, "0")} /
                  18
                </span>
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
                {active.title[language]}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
                {active.summary[language]}
              </p>
            </header>

            <form noValidate onSubmit={calculate} className="mt-6">
              <fieldset>
                <legend className="flex items-center gap-2 text-lg font-semibold">
                  <CircleDollarSign
                    aria-hidden="true"
                    size={20}
                    className="text-[var(--electric)]"
                  />
                  {COPY[language].inputs}
                </legend>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {active.inputs.map((input) => (
                    <InputControl
                      key={input.key}
                      input={input}
                      value={inputs[input.key] ?? ""}
                      language={language}
                      issue={issues.find((issue) => issue.field === input.key)}
                      onChange={updateInput}
                    />
                  ))}
                </div>
              </fieldset>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button type="submit" size="lg">
                  <Calculator aria-hidden="true" size={17} />
                  {dictionary.tools.calculate}
                </Button>
                <Button type="button" variant="secondary" onClick={loadExample}>
                  <ChartNoAxesCombined aria-hidden="true" size={17} />
                  {COPY[language].useExample}
                </Button>
                <Button type="button" variant="ghost" onClick={reset}>
                  <RotateCcw aria-hidden="true" size={16} />
                  {COPY[language].reset}
                </Button>
              </div>
            </form>

            <section className="mt-7" aria-labelledby="tool-result-heading">
              <h3
                id="tool-result-heading"
                className="mb-3 text-lg font-semibold"
              >
                {dictionary.tools.result}
              </h3>
              <Results
                definition={active}
                outcome={outcome}
                language={language}
              />
            </section>

            <section className="mt-7" aria-labelledby="tool-formula-heading">
              <div className="rounded-[var(--radius-md)] border border-[var(--electric)] bg-[var(--electric-soft)] p-4 sm:p-5">
                <h4
                  id="tool-formula-heading"
                  className="flex items-center gap-2 font-semibold"
                >
                  <Info
                    aria-hidden="true"
                    size={18}
                    className="text-[var(--electric)]"
                  />
                  {dictionary.tools.formula}
                </h4>
                <Formula formula={active.formula} language={language} />
                <p className="border-t border-[var(--border-subtle)] pt-3 text-sm leading-6 text-[var(--text-secondary)]">
                  {active.formulaExplanation[language]}
                </p>
              </div>
            </section>

            <section className="mt-5" aria-labelledby="tool-learning-heading">
              <h4
                id="tool-learning-heading"
                className="mb-3 flex items-center gap-2 text-lg font-semibold"
              >
                <BookOpen
                  aria-hidden="true"
                  size={19}
                  className="text-[var(--brand)]"
                />
                {COPY[language].learningContext}
              </h4>
              <div className="grid gap-3 md:grid-cols-2">
                <LearningCard
                  title={dictionary.tools.example}
                  body={active.workedExample[language]}
                />
                <LearningCard
                  title={dictionary.tools.interpretation}
                  body={active.interpretation[language]}
                />
                <LearningCard
                  title={dictionary.tools.mistake}
                  body={active.commonMistake[language]}
                  tone="warning"
                />
                <article className="rounded-[var(--radius-md)] border border-[var(--brand)] bg-[var(--brand-soft)] p-4 sm:p-5">
                  <h4 className="text-sm font-semibold">
                    {dictionary.tools.related}
                  </h4>
                  <Link
                    href={`/lesson/${active.relatedLesson.id}`}
                    className="mt-3 inline-flex min-h-10 items-center gap-2 font-semibold text-[var(--brand)]"
                  >
                    {active.relatedLesson.label[language]}
                    <ArrowRight aria-hidden="true" size={16} />
                  </Link>
                </article>
              </div>
            </section>
          </article>
        </div>
      </section>

      <p className="mx-auto mt-6 max-w-4xl text-center text-xs leading-5 text-[var(--text-tertiary)]">
        {COPY[language].educationOnly}
      </p>
    </>
  );
}
