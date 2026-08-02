"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Clock3,
  FileText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { usePreferences } from "@/features/preferences";
import { MarketingPage } from "@/features/marketing/marketing-shell";
import { practicalContent } from "./content";

const copy = {
  de: {
    eyebrow: "Teacher Mode",
    title:
      "Finanzentscheidungen unterrichten—ohne Konten, Echtgeld oder Ranglisten.",
    intro:
      "Startfertige 45- und 90-Minuten-Aktivitäten verbinden anonyme Antworten mit Prozessbewertung, Diskussion und evidenzbasiertem Debrief.",
    start: "Lehrer-Dashboard öffnen",
    join: "Klasse beitreten",
    how: "So funktioniert eine Sitzung",
    steps: [
      "Aktivität und Dauer wählen",
      "Zeitlich begrenzten Klassencode zeigen",
      "Lernende treten mit Pseudonym bei",
      "Begründungen und Verteilungen live diskutieren",
      "Aggregierten CSV-Bericht exportieren",
    ],
    privacy: "Datenschutz als Unterrichtsregel",
    privacyBody:
      "Keine Namen, E-Mails, Kontodaten oder echten Finanzgeschichten. Codes laufen ab; der Bericht enthält nur aggregierte Lernsignale.",
    activities: "Unterrichtsaktivitäten",
    materials: "Material öffnen",
    age: "Empfohlen",
    minutes: "Minuten",
  },
  sl: {
    eyebrow: "Način za učitelje",
    title:
      "Poučuj finančne odločitve—brez računov, pravega denarja ali lestvic.",
    intro:
      "Pripravljene 45- in 90-minutne dejavnosti povezujejo anonimne odgovore z oceno procesa, razpravo in dokaznim zaključkom.",
    start: "Odpri nadzorno ploščo učitelja",
    join: "Pridruži se razredu",
    how: "Kako poteka srečanje",
    steps: [
      "Izberi dejavnost in trajanje",
      "Prikaži časovno omejeno kodo razreda",
      "Učenci se pridružijo s psevdonimom",
      "V živo razpravljaj o utemeljitvah in porazdelitvah",
      "Izvozi združeno poročilo CSV",
    ],
    privacy: "Zasebnost kot pravilo pouka",
    privacyBody:
      "Brez imen, e-pošte, podatkov računa ali resničnih finančnih zgodb. Kode potečejo; poročilo vsebuje le združene učne signale.",
    activities: "Učne dejavnosti",
    materials: "Odpri gradivo",
    age: "Priporočeno",
    minutes: "minut",
  },
  en: {
    eyebrow: "Teacher Mode",
    title:
      "Teach financial decisions—without accounts, real money, or leaderboards.",
    intro:
      "Ready-to-run 45- and 90-minute activities connect anonymous responses with process scoring, discussion, and an evidence-led debrief.",
    start: "Open teacher dashboard",
    join: "Join a class",
    how: "How a session works",
    steps: [
      "Choose an activity and duration",
      "Display a time-limited class code",
      "Learners join with a pseudonym",
      "Discuss reasoning and distributions live",
      "Export an aggregate CSV report",
    ],
    privacy: "Privacy as a classroom rule",
    privacyBody:
      "No names, emails, account data, or real personal-finance stories. Codes expire; reports contain aggregate learning signals only.",
    activities: "Classroom activities",
    materials: "Open material",
    age: "Recommended",
    minutes: "minutes",
  },
} as const;

export function TeachersPage() {
  const { language } = usePreferences();
  const t = copy[language];
  return (
    <MarketingPage>
      <section className="academy-grid border-b border-[var(--border-subtle)]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--brand)]">
            {t.eyebrow}
          </p>
          <h1 className="mt-5 max-w-5xl text-4xl font-semibold tracking-[-.045em] sm:text-6xl">
            {t.title}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--text-secondary)]">
            {t.intro}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/teacher/dashboard"
              className="inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--brand)] px-5 font-semibold text-[var(--brand-contrast)]"
            >
              {t.start}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              href="/class/DEMO123"
              className="inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-5 font-semibold"
            >
              {t.join}
            </Link>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_.7fr] lg:py-24">
        <article>
          <h2 className="text-3xl font-semibold">{t.how}</h2>
          <ol className="mt-6 space-y-3">
            {t.steps.map((step, index) => (
              <li
                key={step}
                className="flex gap-4 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4"
              >
                <span className="numeric text-[var(--brand)]">
                  0{index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </article>
        <article className="h-fit rounded-[var(--radius-lg)] border border-[var(--brand)] bg-[var(--brand-soft)] p-7">
          <ShieldCheck className="text-[var(--brand)]" aria-hidden="true" />
          <h2 className="mt-4 text-2xl font-semibold">{t.privacy}</h2>
          <p className="mt-3 leading-7 text-[var(--text-secondary)]">
            {t.privacyBody}
          </p>
          <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs">
            <span className="rounded bg-[var(--surface-1)] p-3">
              <Users className="mx-auto mb-2" size={18} />
              Pseudonyms
            </span>
            <span className="rounded bg-[var(--surface-1)] p-3">
              <Clock3 className="mx-auto mb-2" size={18} />
              4h code
            </span>
            <span className="rounded bg-[var(--surface-1)] p-3">
              <BarChart3 className="mx-auto mb-2" size={18} />
              Aggregate
            </span>
          </div>
        </article>
      </section>
      <section
        id="activities"
        className="border-t border-[var(--border-subtle)] bg-[var(--background-raised)]"
      >
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <h2 className="text-3xl font-semibold">{t.activities}</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {practicalContent.classrooms.map((activity) => (
              <article
                key={activity.id}
                className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5"
              >
                <FileText
                  className="text-[var(--brand)]"
                  size={20}
                  aria-hidden="true"
                />
                <p className="mt-4 text-xs font-semibold uppercase tracking-[.12em] text-[var(--text-tertiary)]">
                  {t.age} {activity.recommended_age} · 45/90 {t.minutes}
                </p>
                <h3 className="mt-2 text-xl font-semibold">
                  {activity.title[language]}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                  {activity.summary[language]}
                </p>
                <Link
                  href={`/teachers/materials/${activity.id}`}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand)]"
                >
                  {t.materials}
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
