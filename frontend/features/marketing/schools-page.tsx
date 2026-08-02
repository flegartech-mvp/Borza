"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  GraduationCap,
  ShieldCheck,
  Users,
} from "lucide-react";
import { usePreferences } from "@/features/preferences";
import { MarketingPage } from "./marketing-shell";

const copy = {
  de: {
    eyebrow: "Vorschlag für slowenische Sekundarschulen",
    title:
      "Finanzwissen wird belastbar, wenn Lernende Entscheidungen begründen.",
    intro:
      "Ein modularer 35-Stunden-Programmvorschlag für Gymnasien, Berufs- und Fachschulen. Lehrkräfte verbinden persönliche Finanzen, Verbraucherschutz und Marktgrundlagen mit Fällen, Berechnungen und Reflexion.",
    notice:
      "Borza ist nicht staatlich anerkannt, zertifiziert oder offiziell mit einer Schule oder Behörde verbunden. Der Vorschlag nutzt öffentliche Rahmenwerke als fachliche Orientierung.",
    outcomes: "Vorgeschlagene Lernergebnisse",
    outcomesList: [
      "Ein Budget und einen Notfallplan begründen",
      "Zins, Inflation, Kreditkosten und Nettolohn berechnen",
      "Betrug, Interessenkonflikte und digitale Risiken erkennen",
      "Sparen, Investieren und Spekulieren unterscheiden",
      "Risiko vor Ertrag erklären und Entscheidungen dokumentieren",
    ],
    modules: "35 Stunden in sieben Modulen",
    moduleNames: [
      "Geld, Ziele und Budget",
      "Arbeit, Lohn, Steuern und Inflation",
      "Kredit, Schulden und Verbraucherschutz",
      "Versicherung, Risiko und Widerstandsfähigkeit",
      "Sparen, Investieren und Märkte",
      "Digitale Finanzen, Betrug und Sicherheit",
      "Entscheidungsprojekt und Bewertung",
    ],
    classroom: "Eine Unterrichtsstunde in Borza",
    flow: [
      "Begriff erklären",
      "Fall untersuchen",
      "Rechnen oder visualisieren",
      "Entscheidung simulieren",
      "Prozessfeedback erhalten",
      "Im Journal reflektieren",
    ],
    assessment: "Bewertung ohne Gewinnlogik",
    assessmentBody:
      "Bewertet werden Begründung, Rechengenauigkeit, Quellennutzung, Risikobewusstsein, Regelbefolgung und Reflexion. Ein zufällig profitables Simulationsergebnis verbessert die Note nicht automatisch.",
    pilot: "Vorsichtiger Pilotvorschlag",
    pilotBody:
      "Eine Lehrkraft, eine Klasse, ein 6- bis 8-wöchiger Zeitraum und vorab definierte Lernnachweise. Vorher/Nachher-Aufgaben, Lehrkraftprotokoll, barrierearmes Feedback und ein transparenter Abschlussbericht—ohne Schülerdaten für Werbung zu verwenden.",
    sources: "Öffentliche Orientierung",
    sourceIntro:
      "Diese Quellen stützen den Programmentwurf; sie bedeuten keine Billigung von Borza.",
    docs: "Leitfaden für Lehrkräfte öffnen",
    cta: "Pilotgespräch vorbereiten",
  },
  sl: {
    eyebrow: "Predlog za slovenske srednje šole",
    title: "Finančno znanje postane uporabno, ko dijaki utemeljijo odločitev.",
    intro:
      "Modularni predlog 35-urnega programa za gimnazije ter poklicne in strokovne šole. Učitelji povežejo osebne finance, varstvo potrošnikov in osnove trgov s primeri, izračuni in refleksijo.",
    notice:
      "Borza ni državno potrjena, certificirana ali uradno povezana s šolo ali javnim organom. Predlog uporablja javne okvire le kot strokovno usmeritev.",
    outcomes: "Predlagani učni izidi",
    outcomesList: [
      "Utemeljiti proračun in načrt za nepredvidene dogodke",
      "Izračunati obresti, inflacijo, strošek kredita in neto plačo",
      "Prepoznati prevare, navzkrižja interesov in digitalna tveganja",
      "Ločiti varčevanje, investiranje in špekuliranje",
      "Pojasniti tveganje pred donosom in dokumentirati odločitev",
    ],
    modules: "35 ur v sedmih modulih",
    moduleNames: [
      "Denar, cilji in proračun",
      "Delo, plača, davki in inflacija",
      "Krediti, dolgovi in varstvo potrošnikov",
      "Zavarovanje, tveganje in odpornost",
      "Varčevanje, investiranje in trgi",
      "Digitalne finance, prevare in varnost",
      "Odločitveni projekt in ocenjevanje",
    ],
    classroom: "Učna ura z Borzo",
    flow: [
      "Razlaga pojma",
      "Preučitev primera",
      "Izračun ali prikaz",
      "Simulirana odločitev",
      "Povratna informacija o procesu",
      "Refleksija v dnevniku",
    ],
    assessment: "Ocenjevanje brez logike dobička",
    assessmentBody:
      "Ocenjujejo se utemeljitev, pravilnost izračunov, uporaba virov, razumevanje tveganj, spoštovanje pravil in refleksija. Naključno donosen rezultat simulacije sam po sebi ne zviša ocene.",
    pilot: "Previden predlog pilota",
    pilotBody:
      "En učitelj, en razred, obdobje 6–8 tednov in vnaprej določeni dokazi o učenju. Začetne in končne naloge, dnevnik učitelja, dostopne povratne informacije in transparentno poročilo—brez uporabe podatkov dijakov za oglaševanje.",
    sources: "Javna strokovna izhodišča",
    sourceIntro:
      "Ti viri podpirajo zasnovo programa; ne pomenijo podpore ali potrditve Borze.",
    docs: "Odpri vodnik za učitelje",
    cta: "Pripravi pogovor o pilotu",
  },
  en: {
    eyebrow: "Proposal for Slovenian secondary schools",
    title:
      "Financial knowledge becomes useful when students can defend a decision.",
    intro:
      "A modular 35-hour programme proposal for gimnazija, vocational, and technical schools. Teachers connect personal finance, consumer protection, and market foundations through cases, calculations, and reflection.",
    notice:
      "Borza is not state-approved, certified, or officially affiliated with any school or public authority. The proposal uses public frameworks as professional reference points only.",
    outcomes: "Proposed learning outcomes",
    outcomesList: [
      "Defend a budget and emergency plan",
      "Calculate interest, inflation, borrowing cost, and net pay",
      "Recognise scams, conflicts of interest, and digital risks",
      "Distinguish saving, investing, and speculation",
      "Explain risk before reward and document a decision",
    ],
    modules: "35 hours across seven modules",
    moduleNames: [
      "Money, goals, and budgeting",
      "Work, pay, tax, and inflation",
      "Credit, debt, and consumer protection",
      "Insurance, risk, and resilience",
      "Saving, investing, and markets",
      "Digital finance, scams, and safety",
      "Decision project and assessment",
    ],
    classroom: "A Borza classroom session",
    flow: [
      "Explain a concept",
      "Investigate a case",
      "Calculate or visualise",
      "Make a simulated decision",
      "Receive process feedback",
      "Reflect in a journal",
    ],
    assessment: "Assessment without profit logic",
    assessmentBody:
      "Evidence includes reasoning, calculation accuracy, source use, risk awareness, rule-following, and reflection. A lucky profitable simulation does not automatically improve the grade.",
    pilot: "A cautious pilot proposal",
    pilotBody:
      "One teacher, one class, a 6–8 week window, and learning evidence agreed in advance. Use pre/post tasks, a teacher log, accessible feedback, and a transparent closing report—without using student data for promotion.",
    sources: "Public reference points",
    sourceIntro:
      "These sources inform the programme design; they do not imply endorsement of Borza.",
    docs: "Open the teacher guide",
    cta: "Prepare a pilot conversation",
  },
} as const;

const sources = [
  {
    title: "Nacionalni program finančnega opismenjevanja",
    publisher: "Vlada Republike Slovenije",
    href: "https://www.gov.si/teme/financno-opismenjevanje/",
  },
  {
    title: "Financial literacy and Education Days",
    publisher: "Banka Slovenije",
    href: "https://www.bsi.si/en/financial-literacy",
  },
  {
    title: "Financial competence framework for children and youth",
    publisher: "European Union / OECD",
    href: "https://www.oecd.org/en/publications/financial-competence-framework-for-children-and-youth-in-the-european-union_bf059471-en.html",
  },
  {
    title: "Pilot projects for sustainability and financial literacy",
    publisher: "Ministry of Education, Slovenia",
    href: "https://www.gov.si/novice/2025-03-04-objavljen-je-javni-razpis-razvoj-in-krepitev-kompetenc-za-trajnostni-razvoj-in-financno-pismenost/",
  },
];

export function SchoolsPage() {
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
          <div className="mt-8 max-w-4xl rounded-[var(--radius-md)] border border-[var(--warning)] bg-[var(--warning-soft)] p-5 text-sm leading-6">
            <ShieldCheck
              className="mb-3 text-[var(--warning)]"
              aria-hidden="true"
            />
            {t.notice}
          </div>
        </div>
      </section>

      <section
        id="programme"
        className="scroll-mt-24 mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24"
      >
        <article className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-7">
          <GraduationCap className="text-[var(--brand)]" aria-hidden="true" />
          <h2 className="mt-5 text-2xl font-semibold">{t.outcomes}</h2>
          <ul className="mt-5 space-y-3">
            {t.outcomesList.map((item) => (
              <li
                key={item}
                className="flex gap-3 text-sm leading-6 text-[var(--text-secondary)]"
              >
                <CheckCircle2
                  className="mt-1 shrink-0 text-[var(--brand)]"
                  size={17}
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--background-raised)] p-7">
          <BookOpenCheck
            className="text-[var(--electric)]"
            aria-hidden="true"
          />
          <h2 className="mt-5 text-2xl font-semibold">{t.modules}</h2>
          <ol className="mt-5 grid gap-2 sm:grid-cols-2">
            {t.moduleNames.map((item, index) => (
              <li
                key={item}
                className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3 text-sm"
              >
                <span className="numeric mr-2 text-[var(--text-tertiary)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {item}
              </li>
            ))}
          </ol>
        </article>
      </section>

      <section className="border-y border-[var(--border-subtle)] bg-[var(--background-raised)]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <h2 className="text-3xl font-semibold">{t.classroom}</h2>
          <div className="mt-8 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            {t.flow.map((item, index) => (
              <div
                key={item}
                className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4"
              >
                <span className="numeric text-xs text-[var(--brand)]">
                  0{index + 1}
                </span>
                <p className="mt-3 text-sm font-semibold leading-6">{item}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <article className="rounded-[var(--radius-md)] border border-[var(--brand)] bg-[var(--brand-soft)] p-6">
              <ClipboardCheck
                className="text-[var(--brand)]"
                aria-hidden="true"
              />
              <h3 className="mt-4 text-xl font-semibold">{t.assessment}</h3>
              <p className="mt-3 leading-7 text-[var(--text-secondary)]">
                {t.assessmentBody}
              </p>
            </article>
            <article className="rounded-[var(--radius-md)] border border-[var(--electric)] bg-[var(--electric-soft)] p-6">
              <Users className="text-[var(--electric)]" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-semibold">{t.pilot}</h3>
              <p className="mt-3 leading-7 text-[var(--text-secondary)]">
                {t.pilotBody}
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="text-3xl font-semibold">{t.sources}</h2>
        <p className="mt-3 text-[var(--text-secondary)]">{t.sourceIntro}</p>
        <div className="mt-7 grid gap-3 md:grid-cols-2">
          {sources.map((source) => (
            <a
              key={source.href}
              href={source.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-24 items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 hover:border-[var(--brand)]"
            >
              <span>
                <span className="block font-semibold">{source.title}</span>
                <span className="mt-1 block text-sm text-[var(--text-tertiary)]">
                  {source.publisher}
                </span>
              </span>
              <ExternalLink
                className="shrink-0 text-[var(--brand)]"
                size={18}
                aria-hidden="true"
              />
            </a>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="#programme"
            className="inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-5 font-semibold"
          >
            {t.docs}
            <BookOpenCheck size={16} aria-hidden="true" />
          </a>
          <Link
            href="/impact#pilot-interest"
            className="inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--brand)] px-5 font-semibold text-[var(--brand-contrast)]"
          >
            {t.cta}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </MarketingPage>
  );
}
