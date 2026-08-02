"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { PageHeading } from "@/components/academy/page-heading";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-provider";
import { useDemoWorkspace } from "@/features/demo/demo-workspace-provider";
import { usePreferences } from "@/features/preferences";
import { academyApi } from "@/lib/api-client";

type RemoteResults = {
  metrics: Record<string, number | string | null>;
  process: {
    score: number;
    followed_rules: string[];
    violated_rules: string[];
    unevaluated_scenario_rules: string[];
  };
  debrief: Record<string, unknown>;
  related_lessons: string[];
  recommended_review_cards: string[];
};

const copy = {
  de: {
    empty: "Schließe zuerst ein Simulator-Szenario ab.",
    description:
      "Ein disziplinierter Verlust kann prozessual besser sein als ein rücksichtsloser Gewinn.",
    sound:
      "Die bewertbaren Regeln wurden befolgt. Prüfe trotzdem, ob Einstieg und Stop im Kontext sinnvoll waren.",
    improve:
      "Wiederhole Positionsgröße und Risikoplan, bevor du das Szenario erneut startest.",
    followed: "Befolgte Regeln",
    violated: "Verletzte Regeln",
    unevaluated: "Nicht automatisch bewertete Szenario-Regeln",
    happened: "Was geschah",
    focus: "Prozessfokus",
    related: "Passende Lektionen",
    cards: "Empfohlene Wiederholungskarten",
    net: "Netto P&L",
    win: "Trefferquote",
    violations: "Regelverstöße",
    error: "Die serverseitige Auswertung konnte nicht geladen werden.",
    improveTitle: "So wird die Entscheidung wiederholbar",
    improveAdvice:
      "Schreibe vor dem nächsten Versuch Begründung, Invalidierung, Risikobudget und Abbruchregel auf. Ändere diese Regeln nicht anhand des Ergebnisses.",
    journal: "Entscheidung im Journal reflektieren",
  },
  sl: {
    empty: "Najprej dokončaj scenarij v simulatorju.",
    description:
      "Disciplinirana izguba je lahko procesno boljša od nepremišljenega dobička.",
    sound:
      "Ocenjena pravila so bila upoštevana. Kljub temu preveri vstop in stop v kontekstu.",
    improve:
      "Pred ponovitvijo scenarija preglej velikost pozicije in načrt tveganja.",
    followed: "Upoštevana pravila",
    violated: "Kršena pravila",
    unevaluated: "Pravila scenarija brez samodejne ocene",
    happened: "Kaj se je zgodilo",
    focus: "Poudarek procesa",
    related: "Povezane lekcije",
    cards: "Priporočene kartice",
    net: "Neto P&L",
    win: "Uspešnost",
    violations: "Kršitve pravil",
    error: "Strežniške ocene ni bilo mogoče naložiti.",
    improveTitle: "Kako odločitev postane ponovljiva",
    improveAdvice:
      "Pred naslednjim poskusom zapiši utemeljitev, razveljavitev, proračun tveganja in pravilo prekinitve. Pravil ne spreminjaj glede na izid.",
    journal: "Premisli o odločitvi v dnevniku",
  },
  en: {
    empty: "Complete a simulator scenario first.",
    description:
      "A disciplined loss can have a better process score than a reckless win.",
    sound:
      "The evaluated rules were followed. Still review whether entry and stop made sense in context.",
    improve:
      "Review position sizing and the risk plan before repeating the scenario.",
    followed: "Rules followed",
    violated: "Rules violated",
    unevaluated: "Scenario rules not automatically evaluated",
    happened: "What happened",
    focus: "Process focus",
    related: "Related lessons",
    cards: "Recommended review cards",
    net: "Net P&L",
    win: "Win rate",
    violations: "Rule violations",
    error: "The server-side result could not be loaded.",
    improveTitle: "How to make the decision repeatable",
    improveAdvice:
      "Before the next attempt, write the reasoning, invalidation, risk budget, and stop rule. Do not change those rules in response to the outcome.",
    journal: "Reflect on the decision in the journal",
  },
};

function localized(
  value: unknown,
  language: "de" | "sl" | "en",
): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const candidate = (value as Record<string, unknown>)[language];
    if (typeof candidate === "string") return candidate;
  }
  return null;
}

export function SimulatorResults() {
  const search = useSearchParams();
  const sessionId = search.get("session");
  const { user } = useAuth();
  const { dictionary, language } = usePreferences();
  const { state } = useDemoWorkspace();
  const strings = copy[language];
  const query = useQuery({
    queryKey: ["academy", "simulator-results", sessionId],
    queryFn: () =>
      academyApi<RemoteResults>(`/simulator/sessions/${sessionId}/results`),
    enabled: Boolean(user && sessionId),
    retry: 1,
  });
  if (query.isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-72" />
      </div>
    );
  if (query.isError && sessionId)
    return (
      <ErrorState
        title={dictionary.simulator.results}
        description={strings.error}
        action={
          <button
            type="button"
            className="font-semibold text-[var(--brand)]"
            onClick={() => void query.refetch()}
          >
            {dictionary.common.retry}
          </button>
        }
      />
    );
  const remote = query.data;
  const local = state.simulatorSummary;
  if (!remote && !local)
    return (
      <EmptyState
        title={dictionary.simulator.results}
        description={strings.empty}
        action={
          <Link href="/simulator" className="font-semibold text-[var(--brand)]">
            {dictionary.common.trySimulator}
          </Link>
        }
      />
    );
  const processScore = remote?.process.score ?? local?.processScore ?? 0;
  const ruleViolations = remote
    ? Number(
        remote.metrics.rule_violations ?? remote.process.violated_rules.length,
      )
    : (local?.ruleViolations ?? 0);
  const netPnl = remote
    ? Number(remote.metrics.net_pnl ?? 0)
    : (local?.netPnl ?? 0);
  const winRate = remote
    ? Number(remote.metrics.win_rate ?? 0)
    : (local?.winRate ?? 0);
  const followed = remote?.process.followed_rules ?? local?.followedRules ?? [];
  const violated = remote?.process.violated_rules ?? local?.violatedRules ?? [];
  const unevaluated =
    remote?.process.unevaluated_scenario_rules ?? local?.unevaluatedRules ?? [];
  const debrief = remote?.debrief ?? local?.debrief ?? {};
  const related = remote?.related_lessons ?? local?.relatedLessons ?? [];
  const cards =
    remote?.recommended_review_cards ?? local?.recommendedReviewCards ?? [];
  const sound = ruleViolations === 0;
  return (
    <>
      <PageHeading
        eyebrow={remote ? "Server session" : dictionary.common.demo}
        title={dictionary.simulator.results}
        description={strings.description}
      />
      <section
        className={`rounded-[var(--radius-lg)] border p-7 ${sound ? "border-[var(--positive)] bg-[var(--positive-soft)]" : "border-[var(--warning)] bg-[var(--warning-soft)]"}`}
      >
        <div className="flex items-center gap-3">
          {sound ? (
            <CheckCircle2
              aria-hidden="true"
              className="text-[var(--positive)]"
            />
          ) : (
            <ShieldCheck aria-hidden="true" className="text-[var(--warning)]" />
          )}
          <h3 className="text-2xl font-semibold">
            {dictionary.simulator.processScore}: {processScore}%
          </h3>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <MetricResult label={strings.net} value={`€${netPnl.toFixed(2)}`} />
          <MetricResult label={strings.win} value={`${winRate.toFixed(1)}%`} />
          <MetricResult
            label={strings.violations}
            value={String(ruleViolations)}
          />
        </div>
        <p className="mt-6 leading-7 text-[var(--text-secondary)]">
          {sound ? strings.sound : strings.improve}
        </p>
      </section>
      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <ResultList title={strings.followed} items={followed} tone="positive" />
        <ResultList title={strings.violated} items={violated} tone="warning" />
        {unevaluated.length ? (
          <ResultList
            title={strings.unevaluated}
            items={unevaluated}
            tone="neutral"
          />
        ) : null}
        {localized(debrief.what_happened, language) ||
        localized(debrief.process_focus, language) ? (
          <article className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5">
            <h3 className="font-semibold">{strings.happened}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              {localized(debrief.what_happened, language)}
            </p>
            <h3 className="mt-4 text-sm font-semibold">{strings.focus}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              {localized(debrief.process_focus, language)}
            </p>
          </article>
        ) : null}
      </section>
      <section className="mt-5 grid gap-4 sm:grid-cols-2">
        <article className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5">
          <h3 className="font-semibold">{strings.related}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {related.length ? (
              related.map((id) => (
                <Link
                  key={id}
                  href={`/lesson/${id}`}
                  className="rounded-full border border-[var(--border-subtle)] px-3 py-2 text-sm font-semibold text-[var(--brand)]"
                >
                  {id.replace("lesson-", "").replaceAll("-", " ")}
                </Link>
              ))
            ) : (
              <span className="text-sm text-[var(--text-tertiary)]">—</span>
            )}
          </div>
        </article>
        <article className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5">
          <h3 className="font-semibold">{strings.cards}</h3>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            {cards.length
              ? cards
                  .map((id) => id.replace("card-", "").replaceAll("-", " "))
                  .join(" · ")
              : "—"}
          </p>
          <Link
            href="/review"
            className="mt-4 inline-flex font-semibold text-[var(--electric)]"
          >
            {dictionary.nav.review}
          </Link>
        </article>
      </section>
      <section className="mt-5 rounded-[var(--radius-md)] border border-[var(--electric)] bg-[var(--electric-soft)] p-5">
        <h3 className="font-semibold">{strings.improveTitle}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
          {strings.improveAdvice}
        </p>
        <Link
          href={sessionId ? `/journal?session=${sessionId}` : "/journal"}
          className="mt-4 inline-flex min-h-11 items-center font-semibold text-[var(--electric)]"
        >
          {strings.journal}
        </Link>
      </section>
    </>
  );
}

function ResultList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "warning" | "neutral";
}) {
  const border =
    tone === "positive"
      ? "border-[var(--positive)]"
      : tone === "warning"
        ? "border-[var(--warning)]"
        : "border-[var(--border-subtle)]";
  return (
    <article
      className={`rounded-[var(--radius-md)] border ${border} bg-[var(--surface-1)] p-5`}
    >
      <h3 className="font-semibold">{title}</h3>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
          {items.map((item) => (
            <li key={item}>• {item.replaceAll("_", " ")}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--text-tertiary)]">—</p>
      )}
    </article>
  );
}

function MetricResult({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-sm)] bg-[var(--surface-1)] p-4">
      <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
      <p className="numeric mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}
