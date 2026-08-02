"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clipboard,
  HandHeart,
  Landmark,
  Route,
  School,
  ShieldCheck,
  Users,
} from "lucide-react";
import { usePreferences } from "@/features/preferences";
import { academyApi } from "@/lib/api-client";
import { MarketingPage } from "./marketing-shell";

const copy = {
  de: {
    eyebrow: "Wirkung mit nachvollziehbaren Grenzen",
    title:
      "Bessere Finanzentscheidungen, bevor echtes Geld den Fehler teuer macht.",
    intro:
      "Borza baut eine praktische Lerninfrastruktur für junge Menschen, Lehrkräfte und Einsteiger. Unterstützung finanziert überprüfbare Inhalte, sichere Simulationen, Barrierefreiheit und Schul-Piloten—keine Renditeversprechen.",
    problem: "Das Problem",
    problemBody:
      "Finanzwissen bleibt oft abstrakt oder wird von Produktwerbung, Social-Media-Sicherheit und Ergebnisdenken überlagert. Lernende brauchen einen geschützten Raum, um Entscheidungen zu rechnen, zu erklären und zu überprüfen.",
    exists: "Was bereits existiert",
    capabilities: [
      "Mehrsprachige strukturierte Lernpfade",
      "Rechner, Diagrammübungen und Wissenschecks",
      "Deterministische Simulation mit Prozessbewertung",
      "Review-System, Fortschritt und Reflexionsjournal",
      "Lehrplanvorschlag für slowenische Sekundarschulen",
    ],
    principles: "Nicht verhandelbare Prinzipien",
    principleList: [
      "Bildung vor Engagement-Tricks",
      "Risiko vor Ertrag",
      "Simulation klar von Realität trennen",
      "Keine Broker-, Signal- oder Copy-Trading-Anbindung",
      "Keine erfundenen Nutzerzahlen, Logos oder Empfehlungen",
    ],
    roadmap: "Nächste messbare Etappen",
    milestones: [
      "Fachreview des Risikomanagement-Pfads",
      "Pilot mit einer Lehrkraft und einer Klasse",
      "Vorher/Nachher-Lernnachweise und Barrierefreiheitsprüfung",
      "Veröffentlichter Pilotbericht mit Grenzen",
      "Wiederholbarer Rollout für weitere Schulen",
    ],
    support: "Wie Organisationen helfen können",
    supportTypes: [
      "Schul-Sponsoring",
      "Stiftungsförderung",
      "CSR-Finanzierung",
      "Verantwortungsvolle Angel-Finanzierung",
      "Fach- und Lehrbeiträge",
      "Pilotlehrkräfte und Schulen",
    ],
    funds: "Beispielhafte Mittelverwendung",
    fundItems: [
      "35% Inhalte und Fachreview",
      "25% Produkt und Barrierefreiheit",
      "20% Pilotdurchführung und Evaluation",
      "10% Sicherheit und Datenschutz",
      "10% Betrieb und transparente Berichterstattung",
    ],
    transparency:
      "Dies sind Planungsbeispiele, keine Zusage oder Spendensammlung. Borza bietet derzeit keinen Zahlungsprozess an. Rechtsträger, steuerliche Behandlung, Datenschutz, Rückerstattung und Reporting müssen vor Geldannahme geklärt sein.",
    interest: "Pilot- oder Unterstützungsinteresse vorbereiten",
    interestBody:
      "Sende ein unverbindliches Gesprächsinteresse. Es wird keine Zahlung ausgelöst; Kontaktdaten werden höchstens 180 Tage für die Pilotabstimmung gespeichert.",
    organisation: "Organisation oder Schule",
    role: "Deine Rolle",
    type: "Interesse",
    note: "Was möchtest du erreichen?",
    email: "Kontakt-E-Mail",
    level: "Vorgeschlagenes Unterstützungsniveau",
    consent: "Ich stimme der Kontaktaufnahme und befristeten Speicherung zu.",
    copy: "Interesse senden",
    copied: "Interesse angenommen. Es wurde keine Zahlung durchgeführt.",
    local:
      "Die API ist nicht erreichbar. Die Notiz wurde nur lokal kopiert und nicht gesendet.",
    levels: [
      "€250 · Lernmaterial",
      "€500 · halbe Klasse",
      "€1.500 · Klassenpilot",
      "€5.000 · Schulpilot",
    ],
    schools: "Schulprogramm ansehen",
  },
  sl: {
    eyebrow: "Učinek z jasnimi omejitvami",
    title:
      "Boljše finančne odločitve, preden napaka s pravim denarjem postane draga.",
    intro:
      "Borza gradi praktično učno infrastrukturo za mlade, učitelje in začetnike. Podpora financira preverljive vsebine, varne simulacije, dostopnost in šolske pilote—ne obljub donosov.",
    problem: "Problem",
    problemBody:
      "Finančno znanje pogosto ostane abstraktno ali ga preglasijo oglaševanje produktov, samozavest družbenih omrežij in osredotočenost na izid. Učeči potrebujejo varen prostor za računanje, razlago in preverjanje odločitev.",
    exists: "Kaj že obstaja",
    capabilities: [
      "Večjezične strukturirane učne poti",
      "Kalkulatorji, vaje z grafi in preverjanje znanja",
      "Deterministična simulacija z oceno procesa",
      "Ponavljanje, napredek in dnevnik refleksije",
      "Predlog programa za slovenske srednje šole",
    ],
    principles: "Načela brez kompromisov",
    principleList: [
      "Izobraževanje pred triki za angažiranost",
      "Tveganje pred donosom",
      "Jasna ločitev simulacije od resničnosti",
      "Brez povezav z brokerji, signali ali copy tradingom",
      "Brez izmišljenih uporabnikov, logotipov ali priporočil",
    ],
    roadmap: "Naslednji merljivi koraki",
    milestones: [
      "Strokovni pregled poti upravljanja tveganj",
      "Pilot z enim učiteljem in enim razredom",
      "Začetni in končni dokazi o učenju ter pregled dostopnosti",
      "Javno poročilo o pilotu z omejitvami",
      "Ponovljiv model za dodatne šole",
    ],
    support: "Kako lahko organizacije pomagajo",
    supportTypes: [
      "Sponzorstvo šole",
      "Fundacijska sredstva",
      "Sredstva družbene odgovornosti",
      "Odgovorna angelska naložba",
      "Strokovni in pedagoški prispevki",
      "Pilotni učitelji in šole",
    ],
    funds: "Primer uporabe sredstev",
    fundItems: [
      "35 % vsebine in strokovni pregled",
      "25 % produkt in dostopnost",
      "20 % izvedba in evalvacija pilota",
      "10 % varnost in zasebnost",
      "10 % delovanje in transparentno poročanje",
    ],
    transparency:
      "To so primeri načrtovanja, ne obljuba ali zbiranje donacij. Borza trenutno nima plačilnega procesa. Pred sprejemom sredstev je treba urediti pravno osebo, davke, zasebnost, vračila in poročanje.",
    interest: "Pripravi interes za pilot ali podporo",
    interestBody:
      "Pošlji neobvezujoč interes za pogovor. Plačilo se ne izvede; kontaktni podatki se za usklajevanje pilota hranijo največ 180 dni.",
    organisation: "Organizacija ali šola",
    role: "Tvoja vloga",
    type: "Vrsta interesa",
    note: "Kaj želiš doseči?",
    email: "Kontaktni e-naslov",
    level: "Predlagana raven podpore",
    consent: "Strinjam se s stikom in časovno omejeno hrambo.",
    copy: "Pošlji interes",
    copied: "Interes je sprejet. Plačilo ni bilo izvedeno.",
    local:
      "API ni dosegljiv. Beležka je bila kopirana le lokalno in ni bila poslana.",
    levels: [
      "€250 · učno gradivo",
      "€500 · polovica razreda",
      "€1.500 · razredni pilot",
      "€5.000 · šolski pilot",
    ],
    schools: "Oglej si šolski program",
  },
  en: {
    eyebrow: "Impact with accountable boundaries",
    title:
      "Better financial decisions before real money makes the mistake expensive.",
    intro:
      "Borza is building practical learning infrastructure for young people, teachers, and beginners. Support funds reviewable content, safe simulations, accessibility, and school pilots—not return promises.",
    problem: "The problem",
    problemBody:
      "Financial knowledge often stays abstract or is crowded out by product marketing, social-media certainty, and outcome bias. Learners need a protected place to calculate, explain, and review decisions.",
    exists: "What already exists",
    capabilities: [
      "Multilingual structured learning paths",
      "Calculators, chart exercises, and knowledge checks",
      "Deterministic simulation with process scoring",
      "Review scheduling, progress, and a reflection journal",
      "A programme proposal for Slovenian secondary schools",
    ],
    principles: "Non-negotiable principles",
    principleList: [
      "Education before engagement tricks",
      "Risk before reward",
      "Clear separation between simulation and reality",
      "No brokerage, signals, or copy-trading integration",
      "No invented usage, logos, or endorsements",
    ],
    roadmap: "Next measurable milestones",
    milestones: [
      "Expert review of the Risk Management path",
      "One teacher and one class pilot",
      "Pre/post learning evidence and accessibility review",
      "Published pilot report with limitations",
      "A repeatable model for additional schools",
    ],
    support: "How organisations can help",
    supportTypes: [
      "School sponsorships",
      "Foundation grants",
      "Corporate social-responsibility funding",
      "Responsible angel investment",
      "Subject and teaching contributors",
      "Pilot teachers and schools",
    ],
    funds: "Illustrative use of funds",
    fundItems: [
      "35% content and expert review",
      "25% product and accessibility",
      "20% pilot delivery and evaluation",
      "10% security and privacy",
      "10% operations and transparent reporting",
    ],
    transparency:
      "These are planning examples, not a commitment or donation solicitation. Borza currently offers no payment flow. Legal recipient, tax treatment, privacy, refunds, and reporting must be defined before accepting money.",
    interest: "Prepare pilot or support interest",
    interestBody:
      "Send a non-binding conversation interest. No payment is initiated; contact data is retained for at most 180 days to coordinate a pilot.",
    organisation: "Organisation or school",
    role: "Your role",
    type: "Type of interest",
    note: "What would you like to achieve?",
    email: "Contact email",
    level: "Proposed support level",
    consent: "I agree to contact and time-limited retention.",
    copy: "Send interest",
    copied: "Interest accepted. No payment was made.",
    local:
      "The API is unavailable. The brief was copied locally and was not sent.",
    levels: [
      "€250 · learning material",
      "€500 · half a class",
      "€1,500 · class pilot",
      "€5,000 · school pilot",
    ],
    schools: "View the school programme",
  },
} as const;

const supportIcons = [
  School,
  Landmark,
  Building2,
  HandHeart,
  Users,
  ShieldCheck,
];

export function ImpactPage() {
  const { language } = usePreferences();
  const t = copy[language];
  const [organisation, setOrganisation] = useState("");
  const [role, setRole] = useState("");
  const [interest, setInterest] = useState("");
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const brief = useMemo(
    () =>
      [
        `Borza Academy — ${t.interest}`,
        `${t.organisation}: ${organisation || "—"}`,
        `${t.role}: ${role || "—"}`,
        `${t.type}: ${interest || "—"}`,
        `${t.email}: ${email || "—"}`,
        `${t.level}: ${level || "—"}`,
        `${t.note}: ${note || "—"}`,
      ].join("\n"),
    [email, interest, level, note, organisation, role, t],
  );
  const submitInterest = async () => {
    setSending(true);
    setStatus("");
    try {
      await academyApi("/partnership-interests", {
        method: "POST",
        body: {
          kind: interest || "classroom_sponsor",
          organisation,
          contact_role: role,
          contact_email: email,
          message: `${level}. ${note}`,
          consent,
          website: "",
        },
      });
      setStatus(t.copied);
    } catch {
      await navigator.clipboard.writeText(brief);
      setStatus(t.local);
    } finally {
      setSending(false);
    }
  };
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
              href="/schools"
              className="inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--brand)] px-5 font-semibold text-[var(--brand-contrast)]"
            >
              {t.schools}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <a
              href="#pilot-interest"
              className="inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-5 font-semibold"
            >
              {t.interest}
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-16 sm:px-6 lg:grid-cols-3 lg:py-24">
        <article className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-7 lg:col-span-1">
          <ShieldCheck className="text-[var(--brand)]" aria-hidden="true" />
          <h2 className="mt-5 text-2xl font-semibold">{t.problem}</h2>
          <p className="mt-3 leading-7 text-[var(--text-secondary)]">
            {t.problemBody}
          </p>
        </article>
        <article className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--background-raised)] p-7 lg:col-span-2">
          <CheckCircle2 className="text-[var(--electric)]" aria-hidden="true" />
          <h2 className="mt-5 text-2xl font-semibold">{t.exists}</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {t.capabilities.map((item) => (
              <li
                key={item}
                className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 text-sm leading-6"
              >
                {item}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="border-y border-[var(--border-subtle)] bg-[var(--background-raised)]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <article>
            <h2 className="text-3xl font-semibold">{t.principles}</h2>
            <ul className="mt-6 space-y-3">
              {t.principleList.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-[var(--text-secondary)]"
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
          <article>
            <Route className="text-[var(--electric)]" aria-hidden="true" />
            <h2 className="mt-4 text-3xl font-semibold">{t.roadmap}</h2>
            <ol className="mt-6 space-y-3">
              {t.milestones.map((item, index) => (
                <li
                  key={item}
                  className="flex gap-4 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4"
                >
                  <span className="numeric text-[var(--electric)]">
                    0{index + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="text-3xl font-semibold">{t.support}</h2>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {t.supportTypes.map((item, index) => {
            const Icon = supportIcons[index];
            return (
              <article
                key={item}
                className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5"
              >
                <Icon
                  className="text-[var(--brand)]"
                  size={20}
                  aria-hidden="true"
                />
                <h3 className="mt-4 font-semibold">{item}</h3>
              </article>
            );
          })}
        </div>
        <article className="mt-8 rounded-[var(--radius-lg)] border border-[var(--warning)] bg-[var(--warning-soft)] p-7">
          <h2 className="text-2xl font-semibold">{t.funds}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {t.fundItems.map((item) => (
              <div
                key={item}
                className="rounded-[var(--radius-sm)] bg-[var(--surface-1)] p-4 text-sm font-semibold leading-6"
              >
                {item}
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm leading-6 text-[var(--text-secondary)]">
            {t.transparency}
          </p>
        </article>
      </section>

      <section
        id="pilot-interest"
        className="scroll-mt-24 border-t border-[var(--border-subtle)] bg-[var(--background-raised)]"
      >
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
          <h2 className="text-3xl font-semibold">{t.interest}</h2>
          <p className="mt-3 max-w-2xl leading-7 text-[var(--text-secondary)]">
            {t.interestBody}
          </p>
          <form
            className="mt-7 grid gap-4 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6"
            onSubmit={(event) => {
              event.preventDefault();
              void submitInterest();
            }}
          >
            <label className="text-sm font-semibold">
              {t.organisation}
              <input
                value={organisation}
                onChange={(event) => setOrganisation(event.target.value)}
                required
                minLength={2}
                className="mt-2 min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 font-normal"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                {t.role}
                <input
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  required
                  minLength={2}
                  className="mt-2 min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 font-normal"
                />
              </label>
              <label className="text-sm font-semibold">
                {t.type}
                <select
                  value={interest}
                  onChange={(event) => setInterest(event.target.value)}
                  required
                  className="mt-2 min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 font-normal"
                >
                  <option value="">—</option>
                  <option value="teacher_pilot">Teacher pilot</option>
                  <option value="classroom_sponsor">Classroom sponsor</option>
                  <option value="foundation">Foundation</option>
                  <option value="partner">Partner</option>
                </select>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                {t.email}
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 font-normal"
                />
              </label>
              <label className="text-sm font-semibold">
                {t.level}
                <select
                  required
                  value={level}
                  onChange={(event) => setLevel(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 font-normal"
                >
                  <option value="">—</option>
                  {t.levels.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="text-sm font-semibold">
              {t.note}
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                required
                minLength={20}
                className="mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 font-normal"
              />
            </label>
            <label className="flex items-start gap-3 text-sm leading-6">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-1 accent-[var(--brand)]"
              />
              <span>{t.consent}</span>
            </label>
            <button
              type="submit"
              disabled={sending}
              className="inline-flex min-h-12 w-fit items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--brand)] px-5 font-semibold text-[var(--brand-contrast)]"
            >
              <Clipboard size={17} aria-hidden="true" />
              {sending ? "…" : t.copy}
            </button>
            {status ? (
              <p role="status" className="text-sm text-[var(--positive)]">
                {status}
              </p>
            ) : null}
          </form>
        </div>
      </section>
    </MarketingPage>
  );
}
