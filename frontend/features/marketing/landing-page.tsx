"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Calculator,
  ChartCandlestick,
  CheckCircle2,
  Languages,
  GraduationCap,
  LineChart,
  Play,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { BrandMark } from "@/components/shell/brand-mark";
import {
  LanguageSwitcher,
  ThemeSwitcher,
  usePreferences,
} from "@/features/preferences";
import { DEMO_PATHS } from "@/lib/demo-academy";

const landingCopy = {
  de: {
    lesson: "Ordne Kapitalflüsse dem Primär- oder Sekundärmarkt zu.",
    simulatorTitle: "Entscheidungen üben, ohne echtes Geld zu riskieren",
    simulatorBody:
      "Verdeckte Kerzen, simulierte Kosten, Orders, Stops und Prozessfeedback bilden einen reproduzierbaren Übungsraum.",
    student: "Für Studierende",
    studentBody:
      "Verbinde Zeitwert, Märkte, Unternehmensfinanzierung und Rechenpraxis mit einem klaren Curriculum.",
    trader: "Für verantwortungsvolle Trader",
    traderBody:
      "Trainiere Ausführung, Positionsgröße, Verlustgrenzen und Journaling, bevor Ergebnisdenken übernimmt.",
    progress: "Fortschritt aus mehreren Belegen",
    progressBody:
      "Lektionsabschluss, Quizleistung, Abrufstärke, Rechnerpraxis, Simulator-Regeltreue und Reflexion ergeben gemeinsam Mastery.",
    states: ["Eingeführt", "In Übung", "Sicher", "Gemeistert"],
  },
  sl: {
    lesson: "Tokove kapitala razvrsti na primarni ali sekundarni trg.",
    simulatorTitle: "Vadi odločitve brez tveganja pravega denarja",
    simulatorBody:
      "Skrite sveče, simulirani stroški, naročila, stopi in povratne informacije ustvarijo ponovljivo vajo.",
    student: "Za študente",
    studentBody:
      "Poveži časovno vrednost, trge, poslovne finance in računanje z jasnim učnim načrtom.",
    trader: "Za odgovorne traderje",
    traderBody:
      "Vadi izvršitev, velikost pozicije, omejitve izgub in dnevnik, preden prevlada razmišljanje o izidu.",
    progress: "Napredek iz več dokazov",
    progressBody:
      "Lekcije, kvizi, priklic, kalkulatorji, pravila simulatorja in razmislek skupaj tvorijo obvladovanje.",
    states: ["Predstavljeno", "Vaja", "Usposobljeno", "Obvladano"],
  },
  en: {
    lesson: "Classify capital flows as primary or secondary market activity.",
    simulatorTitle: "Practise decisions without risking real money",
    simulatorBody:
      "Hidden candles, simulated costs, orders, stops, and process feedback create a reproducible practice space.",
    student: "For students",
    studentBody:
      "Connect time value, markets, corporate finance, and calculation practice through a clear curriculum.",
    trader: "For responsible traders",
    traderBody:
      "Train execution, position size, loss limits, and journaling before outcome thinking takes over.",
    progress: "Progress from multiple evidence types",
    progressBody:
      "Lesson completion, quiz performance, recall, calculators, simulator rules, and reflection combine into mastery.",
    states: ["Introduced", "Practising", "Proficient", "Mastered"],
  },
};

export function LandingPage() {
  const { dictionary, language } = usePreferences();
  const copy = landingCopy[language];
  const features = [
    {
      icon: ShieldCheck,
      title: dictionary.landing.riskTitle,
      body: dictionary.landing.riskBody,
    },
    {
      icon: Languages,
      title: dictionary.landing.multilingual,
      body: dictionary.landing.multilingualBody,
    },
    {
      icon: Calculator,
      title: dictionary.landing.toolsTitle,
      body: dictionary.landing.toolsBody,
    },
  ];
  return (
    <main>
      <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--background)_90%,transparent)] backdrop-blur">
        <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <BrandMark />
          <div className="flex items-center gap-2">
            <div className="hidden lg:block">
              <ThemeSwitcher />
            </div>
            <LanguageSwitcher compact />
            <Link
              href="/sign-in"
              aria-label={dictionary.auth.signIn}
              className="hidden min-h-10 items-center rounded-[var(--radius-sm)] border border-[var(--border-subtle)] px-3 text-sm font-semibold sm:inline-flex"
            >
              {dictionary.auth.signIn}
            </Link>
          </div>
        </div>
      </header>

      <section className="academy-grid overflow-hidden border-b border-[var(--border-subtle)]">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:py-28">
          <div>
            <span className="inline-flex rounded-full border border-[var(--brand)] bg-[var(--brand-soft)] px-3 py-1 text-xs font-semibold text-[var(--brand)]">
              {dictionary.landing.eyebrow}
            </span>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-[-0.045em] sm:text-6xl lg:text-[68px] lg:leading-[1.02]">
              {dictionary.landing.title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
              {dictionary.landing.body}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/onboarding"
                className="inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-sm)] bg-[#044b39] px-5 font-semibold text-[#ffffff] dark:bg-[#4fe5b7] dark:text-[#06110e]"
              >
                {dictionary.common.start}
                <ArrowRight aria-hidden="true" size={17} />
              </Link>
              <Link
                href="/simulator"
                className="inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-5 font-semibold"
              >
                <ChartCandlestick aria-hidden="true" size={18} />
                {dictionary.common.trySimulator}
              </Link>
            </div>
            <p className="mt-5 max-w-2xl text-xs leading-5 text-[var(--text-tertiary)]">
              {dictionary.landing.responsible}
            </p>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 -z-10 rounded-full bg-[var(--brand-soft)] blur-3xl" />
            <article className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-1)] shadow-[var(--shadow-floating)]">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
                <span className="text-xs font-semibold text-[var(--brand)]">
                  {dictionary.common.demo} · 18 min
                </span>
                <span className="numeric text-xs text-[var(--text-tertiary)]">
                  01 / 08
                </span>
              </div>
              <div className="reading-surface p-6 sm:p-8">
                <BookOpenCheck aria-hidden="true" className="text-[#087f61]" />
                <h2 className="mt-5 text-2xl font-semibold tracking-tight">
                  {DEMO_PATHS[0].previewTopics[language][0]}
                </h2>
                <p className="mt-4 leading-7 text-[#4e5a60]">
                  {dictionary.landing.lessonPreview}. {copy.lesson}
                </p>
                <div className="mt-6 grid gap-2">
                  {[
                    dictionary.lesson.objectives,
                    dictionary.lesson.exercise,
                    dictionary.lesson.check,
                  ].map((label) => (
                    <div
                      key={label}
                      className="flex items-center gap-3 rounded-xl border border-[#d8d3c8] bg-white/55 px-4 py-3 text-sm"
                    >
                      <CheckCircle2
                        aria-hidden="true"
                        size={17}
                        className="text-[#087f61]"
                      />
                      {label}
                    </div>
                  ))}
                </div>
                <Link
                  href="/lesson/lesson-ff-finance-map"
                  className="mt-7 inline-flex items-center gap-2 font-semibold text-[#087f61]"
                >
                  {dictionary.common.continue}
                  <ArrowRight aria-hidden="true" size={16} />
                </Link>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-4 md:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="content-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                <Icon aria-hidden="true" size={20} />
              </span>
              <h2 className="mt-5 text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                {body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[var(--border-subtle)] bg-[var(--background-raised)]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--brand)]">
            {dictionary.landing.pathsTitle}
          </p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
            {dictionary.landing.pathsBody}
          </h2>
          <div className="mt-9 grid gap-4 md:grid-cols-2">
            {DEMO_PATHS.map((path, index) => (
              <Link
                key={path.id}
                href={`/learn/${path.id}`}
                className="group rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 hover:border-[var(--brand)]"
              >
                <span className="numeric text-xs text-[var(--text-tertiary)]">
                  0{index + 1}
                </span>
                <h2 className="mt-4 text-xl font-semibold">
                  {path.title[language]}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  {path.summary[language]}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand)]">
                  {dictionary.learn.openPath}
                  <ArrowRight aria-hidden="true" size={15} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2">
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-8">
          <ChartCandlestick
            aria-hidden="true"
            className="text-[var(--electric)]"
          />
          <h2 className="mt-5 text-2xl font-semibold">
            {dictionary.landing.chartPreview}
          </h2>
          <p className="mt-3 leading-7 text-[var(--text-secondary)]">
            {dictionary.practice.intro}
          </p>
          <Link
            href="/practice"
            className="mt-6 inline-flex items-center gap-2 font-semibold text-[var(--electric)]"
          >
            {dictionary.nav.practice}
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--brand)] bg-[var(--brand-soft)] p-8">
          <ShieldCheck aria-hidden="true" className="text-[var(--brand)]" />
          <h2 className="mt-5 text-2xl font-semibold">
            {dictionary.landing.riskTitle}
          </h2>
          <p className="mt-3 leading-7 text-[var(--text-secondary)]">
            {dictionary.landing.riskBody}
          </p>
          <Link
            href="/learn/path-risk-management"
            className="mt-6 inline-flex items-center gap-2 font-semibold text-[var(--brand)]"
          >
            {dictionary.learn.openPath}
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
      </section>

      <section className="border-y border-[var(--border-subtle)] bg-[var(--background-raised)]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <div>
            <Play aria-hidden="true" className="text-[var(--electric)]" />
            <h2 className="mt-5 text-3xl font-semibold tracking-tight">
              {copy.simulatorTitle}
            </h2>
            <p className="mt-4 max-w-xl leading-7 text-[var(--text-secondary)]">
              {copy.simulatorBody}
            </p>
            <Link
              href="/simulator"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--brand)] px-4 font-semibold text-[var(--brand-contrast)]"
            >
              {dictionary.common.trySimulator}
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-1)] p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <span className="text-sm font-semibold">
                {dictionary.simulator.title}
              </span>
              <span className="rounded-full bg-[var(--warning-soft)] px-2 py-1 text-xs text-[var(--warning)]">
                {dictionary.common.demo}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                dictionary.simulator.balance,
                dictionary.simulator.equity,
                dictionary.simulator.processScore,
              ].map((label, index) => (
                <div
                  key={label}
                  className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-3"
                >
                  <p className="text-[10px] text-[var(--text-tertiary)]">
                    {label}
                  </p>
                  <p className="numeric mt-2 font-semibold">
                    {index < 2 ? "€10,000" : "—"}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 h-40 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[linear-gradient(135deg,var(--surface-2),var(--background-raised))] p-4">
              <div className="h-full bg-[repeating-linear-gradient(0deg,transparent,transparent_31px,var(--chart-grid)_32px),repeating-linear-gradient(90deg,transparent,transparent_47px,var(--chart-grid)_48px)]">
                <div className="relative top-20 h-0.5 rotate-[-5deg] bg-[var(--electric)]" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <span className="rounded-md bg-[var(--brand)] px-3 py-2 text-xs font-semibold text-[var(--brand-contrast)]">
                {dictionary.simulator.play}
              </span>
              <span className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-xs">
                {dictionary.simulator.step}
              </span>
              <span className="ml-auto rounded-md border border-[var(--border-subtle)] px-3 py-2 text-xs">
                {dictionary.simulator.risk}: 0.5%
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-7">
            <GraduationCap aria-hidden="true" className="text-[var(--brand)]" />
            <h2 className="mt-5 text-2xl font-semibold">{copy.student}</h2>
            <p className="mt-3 leading-7 text-[var(--text-secondary)]">
              {copy.studentBody}
            </p>
          </article>
          <article className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-7">
            <LineChart aria-hidden="true" className="text-[var(--electric)]" />
            <h2 className="mt-5 text-2xl font-semibold">{copy.trader}</h2>
            <p className="mt-3 leading-7 text-[var(--text-secondary)]">
              {copy.traderBody}
            </p>
          </article>
        </div>
        <article className="mt-5 rounded-[var(--radius-lg)] border border-[var(--brand)] bg-[var(--brand-soft)] p-7 sm:p-9">
          <Trophy aria-hidden="true" className="text-[var(--brand)]" />
          <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <h2 className="text-2xl font-semibold">{copy.progress}</h2>
              <p className="mt-3 leading-7 text-[var(--text-secondary)]">
                {copy.progressBody}
              </p>
              <Link
                href="/progress"
                className="mt-5 inline-flex items-center gap-2 font-semibold text-[var(--brand)]"
              >
                {dictionary.nav.progress}
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {copy.states.map((state, index) => (
                <div
                  key={state}
                  className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4"
                >
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>{state}</span>
                    <span className="numeric text-[var(--text-tertiary)]">
                      {[20, 45, 72, 90][index]}%
                    </span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-[var(--surface-3)]">
                    <div
                      className="h-full rounded-full bg-[var(--brand)]"
                      style={{ width: `${[20, 45, 72, 90][index]}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
