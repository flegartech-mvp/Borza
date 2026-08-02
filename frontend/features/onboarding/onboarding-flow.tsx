"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoWorkspace } from "@/features/demo/demo-workspace-provider";
import { LanguageSwitcher, usePreferences } from "@/features/preferences";
import type { OnboardingAnswers } from "@/lib/academy-types";

const fields: Array<keyof Omit<OnboardingAnswers, "recommendation">> = [
  "goal",
  "level",
  "interest",
  "weekly",
  "experience",
  "risk",
  "style",
  "placement",
];

function localizedOptions(language: "de" | "sl" | "en") {
  const values = {
    de: {
      goal: [
        "Finanzen von Grund auf verstehen",
        "Auf ein Finanzstudium vorbereiten",
        "Tradingmechanik lernen",
        "Risikomanagement verbessern",
      ],
      level: ["Anfänger", "Grundkenntnisse", "Mittelstufe"],
      interest: ["Vorwiegend Finanzen", "Ausgewogen", "Vorwiegend Trading"],
      weekly: ["1–2 Stunden", "3–4 Stunden", "5+ Stunden"],
      experience: ["Keine", "Beobachtet", "Paper Trading", "Eigene Erfahrung"],
      risk: ["Neu für mich", "Grundlagen", "Ich nutze feste Regeln"],
      style: [
        "Lesen und Beispiele",
        "Interaktive Übungen",
        "Charts und Szenarien",
      ],
      placement: [
        "Überspringen",
        "Positionsgröße begrenzt den Verlust",
        "Ein hoher Hebel verhindert Verluste",
        "Ein enger Stop garantiert Sicherheit",
      ],
    },
    sl: {
      goal: [
        "Razumeti finance od začetka",
        "Priprava na študij financ",
        "Naučiti se mehanike trgovanja",
        "Izboljšati upravljanje tveganj",
      ],
      level: ["Začetnik", "Osnovno znanje", "Srednja raven"],
      interest: ["Predvsem finance", "Uravnoteženo", "Predvsem trgovanje"],
      weekly: ["1–2 uri", "3–4 ure", "5+ ur"],
      experience: [
        "Brez izkušenj",
        "Spremljanje trgov",
        "Papirno trgovanje",
        "Lastne izkušnje",
      ],
      risk: ["Novo zame", "Osnove", "Uporabljam trdna pravila"],
      style: ["Branje in primeri", "Interaktivne vaje", "Grafi in scenariji"],
      placement: [
        "Preskoči",
        "Velikost pozicije omeji izgubo",
        "Visok vzvod prepreči izgube",
        "Tesni stop zagotovi varnost",
      ],
    },
    en: {
      goal: [
        "Understand finance from zero",
        "Prepare for finance studies",
        "Learn trading mechanics",
        "Improve risk management",
      ],
      level: ["Beginner", "Some foundations", "Intermediate"],
      interest: ["Mostly finance", "Balanced", "Mostly trading"],
      weekly: ["1–2 hours", "3–4 hours", "5+ hours"],
      experience: [
        "None",
        "Market observer",
        "Paper trading",
        "Personal experience",
      ],
      risk: ["New to me", "Foundations", "I use fixed rules"],
      style: [
        "Reading and examples",
        "Interactive exercises",
        "Charts and scenarios",
      ],
      placement: [
        "Skip",
        "Position size limits the loss",
        "High leverage prevents losses",
        "A tight stop guarantees safety",
      ],
    },
  }[language];
  return values;
}

export function OnboardingFlow() {
  const { dictionary, language } = usePreferences();
  const { saveOnboarding, mode } = useDemoWorkspace();
  const router = useRouter();
  const options = useMemo(() => localizedOptions(language), [language]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<OnboardingAnswers>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = fields[step];
  const labels = dictionary.onboarding;
  const fieldLabel = labels[current];
  const recommendation =
    answers.interest?.includes(
      language === "de"
        ? "Trading"
        : language === "sl"
          ? "trgovanje"
          : "trading",
    ) ||
    answers.goal
      ?.toLowerCase()
      .includes(
        language === "de" ? "risiko" : language === "sl" ? "tvegan" : "risk",
      )
      ? "path-risk-management"
      : "path-finance-foundations";
  const finish = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveOnboarding({
        goal: answers.goal ?? "",
        level: answers.level ?? "",
        interest: answers.interest ?? "",
        weekly: answers.weekly ?? "",
        experience: answers.experience ?? "",
        risk: answers.risk ?? "",
        style: answers.style ?? "",
        placement: answers.placement ?? "",
        recommendation,
      });
      router.push("/home");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : dictionary.auth.error,
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <main className="academy-grid min-h-dvh px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-[var(--brand)]">
            ← Borza Academy
          </Link>
          <LanguageSwitcher compact />
        </div>
        <section className="mt-8 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-1)] shadow-[var(--shadow-floating)]">
          <div className="border-b border-[var(--border-subtle)] px-6 py-5 sm:px-9">
            <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
              <span>
                {mode === "demo"
                  ? dictionary.common.localDemo
                  : dictionary.auth.register}
              </span>
              <span className="numeric">
                {step + 1} / {fields.length}
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
              <div
                className="h-full bg-[var(--brand)] transition-[width]"
                style={{ width: `${((step + 1) / fields.length) * 100}%` }}
              />
            </div>
          </div>
          <div className="p-6 sm:p-9">
            <ClipboardCheck
              aria-hidden="true"
              className="text-[var(--brand)]"
            />
            <h1 className="mt-5 text-3xl font-semibold tracking-tight">
              {dictionary.onboarding.title}
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-[var(--text-secondary)]">
              {step === 0
                ? dictionary.onboarding.intro
                : current === "placement"
                  ? dictionary.onboarding.placementQuestion
                  : fieldLabel}
            </p>
            <fieldset className="mt-7 grid gap-3">
              <legend className="sr-only">{fieldLabel}</legend>
              {options[current].map((option) => (
                <label key={option} className="cursor-pointer">
                  <input
                    type="radio"
                    name={current}
                    value={option}
                    checked={answers[current] === option}
                    onChange={() =>
                      setAnswers((value) => ({ ...value, [current]: option }))
                    }
                    className="peer sr-only"
                  />
                  <span className="flex min-h-14 items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 peer-checked:border-[var(--brand)] peer-checked:bg-[var(--brand-soft)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--electric)]">
                    <CheckCircle2
                      aria-hidden="true"
                      size={18}
                      className="text-[var(--text-tertiary)] peer-checked:text-[var(--brand)]"
                    />
                    {option}
                  </span>
                </label>
              ))}
            </fieldset>
            {step === fields.length - 1 ? (
              <div className="mt-6 rounded-[var(--radius-sm)] border border-[var(--brand)] bg-[var(--brand-soft)] p-4">
                <p className="text-xs font-semibold text-[var(--brand)]">
                  {dictionary.onboarding.recommendation}
                </p>
                <p className="mt-1 font-semibold">
                  {recommendation === "path-risk-management"
                    ? {
                        de: "Risikomanagement",
                        sl: "Upravljanje tveganj",
                        en: "Risk Management",
                      }[language]
                    : {
                        de: "Finanzgrundlagen",
                        sl: "Osnove financ",
                        en: "Finance Foundations",
                      }[language]}
                </p>
              </div>
            ) : null}
            {error ? (
              <p role="alert" className="mt-4 text-sm text-[var(--negative)]">
                {error}
              </p>
            ) : null}
            <div className="mt-8 flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                disabled={step === 0}
                onClick={() => setStep((value) => Math.max(0, value - 1))}
              >
                <ArrowLeft aria-hidden="true" size={16} />
                {dictionary.common.previous}
              </Button>
              {step < fields.length - 1 ? (
                <Button
                  disabled={!answers[current]}
                  onClick={() => setStep((value) => value + 1)}
                >
                  {dictionary.common.next}
                  <ArrowRight aria-hidden="true" size={16} />
                </Button>
              ) : (
                <Button
                  loading={saving}
                  disabled={!answers[current]}
                  onClick={() => void finish()}
                >
                  {dictionary.onboarding.finish}
                  <ArrowRight aria-hidden="true" size={16} />
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
